import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../../../components/Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("applies primary variant gradient class", () => {
    render(<Button variant="primary">Primary</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("btn-gradient");
  });

  it("applies secondary variant border class", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("border-2");
    expect(btn.className).toContain("border-[#a23f00]");
  });

  it("applies danger variant red background", () => {
    render(<Button variant="danger">Danger</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-[#DC2626]");
  });

  it("applies ghost variant with no background", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("text-[#a23f00]");
    expect(btn.className).toContain("hover:bg-[#faf3d0]");
  });

  it("applies sm size classes", () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("px-4");
    expect(btn.className).toContain("py-2");
    expect(btn.className).toContain("text-sm");
  });

  it("applies md size classes", () => {
    render(<Button size="md">Medium</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("px-6");
    expect(btn.className).toContain("py-3");
  });

  it("applies lg size classes", () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("px-8");
    expect(btn.className).toContain("py-4");
    expect(btn.className).toContain("text-lg");
  });

  it("disables the button when disabled={true}", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disables the button when loading={true}", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows spinner SVG when loading={true}", () => {
    render(<Button loading>Loading</Button>);
    const svg = screen.getByRole("button").querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("does not show spinner when loading={false}", () => {
    render(<Button loading={false}>Not Loading</Button>);
    const svg = screen.getByRole("button").querySelector("svg");
    expect(svg).not.toBeInTheDocument();
  });

  it("forwards ref to underlying button element", () => {
    const ref = { current: null } as React.MutableRefObject<HTMLButtonElement | null>;
    render(<Button ref={ref}>Ref Test</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("passes through extra HTML props (type, onClick, aria-label)", () => {
    const handleClick = vi.fn();
    render(
      <Button type="submit" onClick={handleClick} aria-label="Submit form">
        Submit
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("type")).toBe("submit");
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(btn.getAttribute("aria-label")).toBe("Submit form");
  });

  it("has btn-pill class on primary variant", () => {
    render(<Button variant="primary">Pill</Button>);
    expect(screen.getByRole("button").className).toContain("btn-pill");
  });
});
