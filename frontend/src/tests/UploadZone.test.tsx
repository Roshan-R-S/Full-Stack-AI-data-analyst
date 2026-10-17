// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import UploadZone from "../components/upload/UploadZone";

afterEach(cleanup);

describe("UploadZone", () => {
  it("provides a keyboard-focusable labeled file input", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn(async () => {});

    render(
      <UploadZone uploading={false} onUpload={onUpload} />,
    );

    const input = screen.getByLabelText(
      /\[\s*SELECT CSV\s*\]/i,
    ) as HTMLInputElement;

    expect(input.type).toBe("file");
    expect(input.accept).toContain(".csv");
    expect(input.disabled).toBe(false);

    await user.tab();

    expect(document.activeElement).toBe(input);
  });

  it("accepts a valid CSV file", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn(async () => {});

    render(
      <UploadZone uploading={false} onUpload={onUpload} />,
    );

    const input = screen.getByLabelText(
      /\[\s*SELECT CSV\s*\]/i,
    ) as HTMLInputElement;

    const file = new File(
      ["name,age\nAlice,25"],
      "users.csv",
      { type: "text/csv" },
    );

    await user.upload(input, file);

    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledTimes(1);
    });

    expect(onUpload).toHaveBeenCalledWith(file);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rejects unsupported file extensions", async () => {
    const user = userEvent.setup({
      applyAccept: false,
    });

    const onUpload = vi.fn(async () => {});

    render(
      <UploadZone uploading={false} onUpload={onUpload} />,
    );

    const input = screen.getByLabelText(
      /\[\s*SELECT CSV\s*\]/i,
    ) as HTMLInputElement;

    const file = new File(
      ["not a csv"],
      "notes.txt",
      { type: "text/plain" },
    );

    await user.upload(input, file);

    expect(screen.getByRole("alert").textContent).toContain(
      "ONLY CSV FILES ARE SUPPORTED",
    );

    expect(onUpload).not.toHaveBeenCalled();
  });

  it("rejects files larger than the 10 MB limit", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn(async () => {});

    render(
      <UploadZone uploading={false} onUpload={onUpload} />,
    );

    const input = screen.getByLabelText(
      /\[\s*SELECT CSV\s*\]/i,
    ) as HTMLInputElement;

    const file = new File(
      ["sample"],
      "large.csv",
      { type: "text/csv" },
    );

    Object.defineProperty(file, "size", {
      configurable: true,
      value: 10 * 1024 * 1024 + 1,
    });

    await user.upload(input, file);

    expect(screen.getByRole("alert").textContent).toContain(
      "MAXIMUM FILE SIZE IS 10 MB",
    );

    expect(onUpload).not.toHaveBeenCalled();
  });

  it("disables file selection during an upload", () => {
    const onUpload = vi.fn(async () => {});

    const { container } = render(
      <UploadZone uploading={true} onUpload={onUpload} />,
    );

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    expect(input).not.toBeNull();
    expect(input.disabled).toBe(true);

    expect(
      container.textContent,
    ).toContain("[ UPLOADING... ]");

    expect(
      container.querySelector(
        'label[for="csv-file-input"]',
      ),
    ).toBeNull();
  });
});
