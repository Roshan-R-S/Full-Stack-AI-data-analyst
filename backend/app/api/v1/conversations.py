import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.conversation import Conversation, utc_now
from app.models.message import Message

router = APIRouter(
    prefix="/conversations",
    tags=["Conversation History"],
)


class RenameConversation(BaseModel):
    title: str = Field(min_length=1, max_length=120)


def require_conversation(
    conversation_id: UUID, db: Session
) -> Conversation:
    conversation = db.get(Conversation, str(conversation_id))

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    return conversation


def summarize(conversation: Conversation) -> dict:
    return {
        "id": conversation.id,
        "dataset_id": conversation.dataset_id,
        "title": conversation.title,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
    }


@router.get("")
def list_conversations(
    dataset_id: UUID | None = None,
    db: Session = Depends(get_db),
):
    statement = select(Conversation)

    if dataset_id is not None:
        statement = statement.where(
            Conversation.dataset_id == str(dataset_id)
        )

    conversations = db.scalars(
        statement.order_by(
            Conversation.updated_at.desc(),
            Conversation.id.desc(),
        ).limit(50)
    ).all()

    return [summarize(item) for item in conversations]


@router.get("/{conversation_id}")
def get_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
):
    conversation = require_conversation(conversation_id, db)

    messages = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.id)
    ).all()

    return {
        **summarize(conversation),
        "messages": [
            {
                "id": str(message.id),
                "role": message.role,
                "content": message.content,
                "model": message.model,
                "plan": json.loads(message.plan_json)
                if message.plan_json else None,
                "analysis": json.loads(message.analysis_json)
                if message.analysis_json else None,
                "created_at": message.created_at,
            }
            for message in messages
        ],
    }


@router.patch("/{conversation_id}")
def rename_conversation(
    conversation_id: UUID,
    request: RenameConversation,
    db: Session = Depends(get_db),
):
    conversation = require_conversation(conversation_id, db)

    title = request.title.strip()

    if not title:
        raise HTTPException(
            status_code=422,
            detail="Conversation title cannot be empty.",
        )

    conversation.title = title
    conversation.updated_at = utc_now()
    db.commit()
    db.refresh(conversation)

    return summarize(conversation)


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
):
    conversation = require_conversation(conversation_id, db)

    db.delete(conversation)
    db.commit()

    return Response(status_code=204)