import { render, screen, fireEvent, act } from "@testing-library/react";
import { SkillsClient } from "../SkillsClient";
import { TestWrapper } from "../../../../test-utils";

const FAKE_SKILLS = [
  {
    slug: "avatar-creator",
    name: "Avatar Creator",
    summary: "Make beautiful avatars in seconds",
    authorName: "Alice",
    iconEmoji: "🎨",
    statsStars: 300,
    createdAt: new Date("2025-01-01"),
  },
  {
    slug: "music-mixer",
    name: "Music Mixer",
    summary: "Mix audio tracks with AI",
    authorName: "Bob",
    iconEmoji: "🎮",
    statsStars: 100,
    createdAt: new Date("2025-02-01"),
  },
  {
    slug: "photo-filter",
    name: "Photo Filter",
    summary: "Apply artistic filters to photos",
    authorName: null,
    iconEmoji: "🎨",
    statsStars: 0,
    createdAt: null,
  },
];

// Helper: count skill cards by counting h3 headings with skill names
function skillHeadings() {
  return screen.getAllByRole("heading", { level: 3 });
}

describe("SkillsClient — category filter", () => {
  it("renders all skills when no category filter is active", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    expect(skillHeadings().length).toBe(3);
  });

  it("renders only matching emoji skills when '艺术' filter is active", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const artBtn = screen.getByRole("button", { name: /艺术/ });
    act(() => { artBtn.click(); });
    // 🎨 matches avatar-creator + photo-filter (2 cards)
    expect(skillHeadings().length).toBe(2);
    expect(screen.getByRole("heading", { name: "Avatar Creator" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Photo Filter" })).toBeInTheDocument();
  });

  it("clicking '全部' button shows all skills", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const artBtn = screen.getByRole("button", { name: /艺术/ });
    act(() => { artBtn.click(); });
    expect(skillHeadings().length).toBe(2);

    const allBtn = screen.getByRole("button", { name: /全部/ });
    act(() => { allBtn.click(); });
    expect(skillHeadings().length).toBe(3);
  });

  it("active '全部' button has gradient class", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const allBtn = screen.getByRole("button", { name: /全部/ });
    expect(allBtn.className).toContain("from-[#a23f00]");
    expect(allBtn.className).toContain("to-[#fa7025]");
  });

  it("active category button has gradient class", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const artBtn = screen.getByRole("button", { name: /艺术/ });
    act(() => { artBtn.click(); });
    expect(artBtn.className).toContain("from-[#a23f00]");
  });
});

describe("SkillsClient — search", () => {
  it("filters by skill name (case-insensitive)", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(searchInput, { target: { value: "avatar" } });
    expect(skillHeadings().length).toBe(1);
    expect(screen.getByRole("heading", { name: "Avatar Creator" })).toBeInTheDocument();
  });

  it("filters by summary text", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(searchInput, { target: { value: "audio" } });
    expect(skillHeadings().length).toBe(1);
    expect(screen.getByRole("heading", { name: "Music Mixer" })).toBeInTheDocument();
  });

  it("filters by authorName", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(searchInput, { target: { value: "Alice" } });
    expect(skillHeadings().length).toBe(1);
    expect(screen.getByRole("heading", { name: "Avatar Creator" })).toBeInTheDocument();
  });

  it("shows all skills when search is cleared", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(searchInput, { target: { value: "avatar" } });
    expect(skillHeadings().length).toBe(1);
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(skillHeadings().length).toBe(3);
  });

  it("category filter and search work together", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const artBtn = screen.getByRole("button", { name: /艺术/ });
    act(() => { artBtn.click(); });
    const searchInput = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(searchInput, { target: { value: "photo" } });
    expect(skillHeadings().length).toBe(1);
    expect(screen.getByRole("heading", { name: "Photo Filter" })).toBeInTheDocument();
  });
});

describe("SkillsClient — empty state", () => {
  it("shows empty state when no skills match search", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(searchInput, { target: { value: "xyzabc123" } });
    expect(screen.getByText(/未找到「xyzabc123」/)).toBeInTheDocument();
  });

  it("shows search term in empty state message", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });
    expect(screen.getByText(/未找到「nonexistent」/)).toBeInTheDocument();
  });

  it("'清除搜索' button clears search and shows all skills", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(/搜索/);
    fireEvent.change(searchInput, { target: { value: "xyzabc123" } });
    const clearBtn = screen.getByRole("button", { name: /清除搜索/ });
    act(() => { clearBtn.click(); });
    expect(skillHeadings().length).toBe(3);
    expect(searchInput).toHaveValue("");
  });
});

describe("SkillsClient — card rendering", () => {
  it("shows correct install command per skill", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    expect(screen.getByText("clawplay install avatar-creator")).toBeInTheDocument();
    expect(screen.getByText("clawplay install music-mixer")).toBeInTheDocument();
  });

  it("skill card shows '🦐' emoji fallback when iconEmoji is null", () => {
    const skillsWithNull = [
      {
        slug: "null-emoji-skill",
        name: "Null Emoji Skill",
        summary: "Test",
        authorName: "Tester",
        iconEmoji: null,
        statsStars: 0,
        createdAt: null,
      },
    ];
    render(<SkillsClient initialSkills={skillsWithNull} />, { wrapper: TestWrapper });
    expect(screen.getByText("🦐")).toBeInTheDocument();
  });

  it("skill card shows '匿名' when authorName is null", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    expect(screen.getByText("匿名")).toBeInTheDocument();
  });

  it("skill card shows star rating (statsStars / 100)", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    // Avatar Creator: statsStars=300 → 300/100 = 3.0; rendered as "⭐ 3.0" split across text nodes
    const spans = screen.getAllByText((_, el) => el?.tagName === "SPAN" && el?.textContent?.trim() === "⭐ 3.0");
    expect(spans.length).toBeGreaterThan(0);
  });

  it("renders correct number of skill cards", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    expect(skillHeadings().length).toBe(3);
  });
});
