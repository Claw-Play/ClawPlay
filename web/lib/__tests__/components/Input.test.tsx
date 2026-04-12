import { render, screen } from "@testing-library/react";
import { Input, Textarea } from "../../../components/Input";

describe("Input", () => {
  it("renders label text when label prop is provided", () => {
    render(<Input label="Email Address" />);
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
  });

  it("does not render label element when label is omitted", () => {
    render(<Input />);
    // No label element should be rendered
    const labels = document.querySelectorAll("label");
    expect(labels.length).toBe(0);
  });

  it("auto-generates id from label (kebab-case)", () => {
    render(<Input label="Email Address" />);
    const input = screen.getByLabelText("Email Address");
    expect(input.id).toBe("email-address");
  });

  it("uses provided id when explicitly passed", () => {
    render(<Input label="Email" id="custom-email-id" />);
    const input = screen.getByLabelText("Email");
    expect(input.id).toBe("custom-email-id");
  });

  it("applies error border class border-red-400 when error prop is set", () => {
    render(<Input label="Email" error="Invalid email" />);
    const input = screen.getByLabelText("Email");
    expect(input.className).toContain("border-red-400");
    expect(input.className).toContain("focus:ring-red-300");
  });

  it("renders error message paragraph when error prop is non-empty string", () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
    expect(screen.getByText("Invalid email").tagName).toBe("P");
  });

  it("does not render error message when error is undefined", () => {
    render(<Input label="Email" />);
    const errors = document.querySelectorAll(".text-red-600");
    expect(errors.length).toBe(0);
  });

  it("applies custom bg class when bg prop is provided", () => {
    render(<Input label="Email" bg="bg-[#e7e3ca]" />);
    const input = screen.getByLabelText("Email");
    expect(input.className).toContain("bg-[#e7e3ca]");
  });

  it("defaults to bg-white when no bg is provided", () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText("Email");
    expect(input.className).toContain("bg-white");
  });

  it("passes through type, placeholder, value, onChange, required attributes", () => {
    render(
      <Input
        label="Email"
        type="email"
        placeholder="hello@friend.com"
        required
        value="test@example.com"
        onChange={() => {}}
      />
    );
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.type).toBe("email");
    expect(input.placeholder).toBe("hello@friend.com");
    expect(input.required).toBe(true);
    expect(input.value).toBe("test@example.com");
  });

  it("applies input-radius class (pill shape)", () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText("Email");
    expect(input.className).toContain("input-radius");
  });

  it("uses provided id for htmlFor on label", () => {
    render(<Input label="Search" id="search-input" />);
    const label = document.querySelector("label");
    expect(label?.getAttribute("for")).toBe("search-input");
  });
});

describe("Textarea", () => {
  it("renders textarea element", () => {
    render(<Textarea label="Description" />);
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("applies resize-none class", () => {
    render(<Textarea label="Description" />);
    const textarea = screen.getByLabelText("Description");
    expect(textarea.className).toContain("resize-none");
  });

  it("renders with correct row count", () => {
    render(<Textarea label="Description" rows={18} />);
    const textarea = screen.getByLabelText("Description") as HTMLTextAreaElement;
    expect(textarea.rows).toBe(18);
  });

  it("applies error styling when error prop is set", () => {
    render(<Textarea label="Description" error="Required field" />);
    const textarea = screen.getByLabelText("Description");
    expect(textarea.className).toContain("border-red-400");
  });

  it("renders error message when error prop is provided", () => {
    render(<Textarea label="Description" error="Required field" />);
    expect(screen.getByText("Required field")).toBeInTheDocument();
  });

  it("applies custom bg class when bg prop is provided", () => {
    render(<Textarea label="Description" bg="bg-[#e7e3ca]" />);
    const textarea = screen.getByLabelText("Description");
    expect(textarea.className).toContain("bg-[#e7e3ca]");
  });

  it("auto-generates id from label", () => {
    render(<Textarea label="Skill Content" />);
    const textarea = screen.getByLabelText("Skill Content");
    expect(textarea.id).toBe("skill-content");
  });
});
