import { render, screen, fireEvent, act } from "@testing-library/react";
import { SkillsClient } from "../../../app/(app)/skills/SkillsClient";
import { TestWrapper } from "../../../test-utils";
import zh from "../../../messages/zh.json";

// Import i18n strings directly from the message file to avoid test/i18n drift
const T = zh.skills;

// Category emoji matches SkillsClient.tsx categories
const CAT_EMOJI = {
  art: "💝",     // category_art → iconEmoji must be "💝" to match
  write: "✨",   // category_write
  game: "🎭",   // category_game
  tool: "🔮",   // category_tool
  health: "🎉", // category_health
  extra: "🎮",  // category_extra
};

const FAKE_SKILLS = [
  {
    slug: "avatar-creator",
    name: "Avatar Creator",
    summary: "Make beautiful avatars in seconds",
    authorName: "Alice",
    iconEmoji: CAT_EMOJI.art,  // matches category_art
    statsStars: 300,
    statsRatingsCount: 100,
    createdAt: new Date("2025-01-01"),
  },
  {
    slug: "music-mixer",
    name: "Music Mixer",
    summary: "Mix audio tracks with AI",
    authorName: "Bob",
    iconEmoji: CAT_EMOJI.extra,  // matches category_extra
    statsStars: 100,
    statsRatingsCount: 100,
    createdAt: new Date("2025-02-01"),
  },
  {
    slug: "photo-filter",
    name: "Photo Filter",
    summary: "Apply artistic filters to photos",
    authorName: null,
    iconEmoji: CAT_EMOJI.art,  // matches category_art
    statsStars: 0,
    statsRatingsCount: 0,
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

  it("renders only matching emoji skills when 'category_art' filter is active", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const artBtn = screen.getByRole("button", { name: new RegExp(T.category_art) });
    act(() => { artBtn.click(); });
    // CAT_EMOJI.art matches avatar-creator + photo-filter (2 cards)
    expect(skillHeadings().length).toBe(2);
    expect(screen.getByRole("heading", { name: "Avatar Creator" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Photo Filter" })).toBeInTheDocument();
  });

  it("clicking '全部' button shows all skills", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const artBtn = screen.getByRole("button", { name: new RegExp(T.category_art) });
    act(() => { artBtn.click(); });
    expect(skillHeadings().length).toBe(2);

    const allBtn = screen.getByRole("button", { name: new RegExp(T.category_all) });
    act(() => { allBtn.click(); });
    expect(skillHeadings().length).toBe(3);
  });

  it("active '全部' button has blue active style", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const allBtn = screen.getByRole("button", { name: new RegExp(T.category_all) });
    expect(allBtn.className).toContain("bg-[#2d67f7]");
    expect(allBtn.className).toContain("text-white");
  });

  it("active category button has blue active style", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const artBtn = screen.getByRole("button", { name: new RegExp(T.category_art) });
    act(() => { artBtn.click(); });
    expect(artBtn.className).toContain("bg-[#2d67f7]");
  });
});

describe("SkillsClient — search", () => {
  it("filters by skill name (case-insensitive)", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(new RegExp(T.search_placeholder.split("").slice(0, 4).join("")));
    fireEvent.change(searchInput, { target: { value: "avatar" } });
    expect(skillHeadings().length).toBe(1);
    expect(screen.getByRole("heading", { name: "Avatar Creator" })).toBeInTheDocument();
  });

  it("filters by summary text", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(new RegExp(T.search_placeholder.split("").slice(0, 4).join("")));
    fireEvent.change(searchInput, { target: { value: "audio" } });
    expect(skillHeadings().length).toBe(1);
    expect(screen.getByRole("heading", { name: "Music Mixer" })).toBeInTheDocument();
  });

  it("filters by authorName", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(new RegExp(T.search_placeholder.split("").slice(0, 4).join("")));
    fireEvent.change(searchInput, { target: { value: "Alice" } });
    expect(skillHeadings().length).toBe(1);
    expect(screen.getByRole("heading", { name: "Avatar Creator" })).toBeInTheDocument();
  });

  it("shows all skills when search is cleared", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(new RegExp(T.search_placeholder.split("").slice(0, 4).join("")));
    fireEvent.change(searchInput, { target: { value: "avatar" } });
    expect(skillHeadings().length).toBe(1);
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(skillHeadings().length).toBe(3);
  });

  it("category filter and search work together", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const artBtn = screen.getByRole("button", { name: new RegExp(T.category_art) });
    act(() => { artBtn.click(); });
    const searchInput = screen.getByPlaceholderText(new RegExp(T.search_placeholder.split("").slice(0, 4).join("")));
    fireEvent.change(searchInput, { target: { value: "photo" } });
    expect(skillHeadings().length).toBe(1);
    expect(screen.getByRole("heading", { name: "Photo Filter" })).toBeInTheDocument();
  });
});

describe("SkillsClient — empty state", () => {
  it("shows empty state when no skills match search", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(new RegExp(T.search_placeholder.split("").slice(0, 4).join("")));
    fireEvent.change(searchInput, { target: { value: "xyzabc123" } });
    expect(screen.getByText(new RegExp(`未找到「xyzabc123」`))).toBeInTheDocument();
  });

  it("shows search term in empty state message", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(new RegExp(T.search_placeholder.split("").slice(0, 4).join("")));
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });
    expect(screen.getByText(new RegExp(`未找到「nonexistent」`))).toBeInTheDocument();
  });

  it("'清除搜索' button clears search and shows all skills", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const searchInput = screen.getByPlaceholderText(new RegExp(T.search_placeholder.split("").slice(0, 4).join("")));
    fireEvent.change(searchInput, { target: { value: "xyzabc123" } });
    const clearBtn = screen.getByRole("button", { name: new RegExp(T.clear_search) });
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

  it("renders null-emoji skill card (iconEmoji is not shown in card)", () => {
    const skillsWithNull = [
      {
        slug: "null-emoji-skill",
        name: "Null Emoji Skill",
        summary: "Test",
        authorName: "Tester",
        iconEmoji: null,
        statsStars: 0,
        statsRatingsCount: 0,
        createdAt: null,
      },
    ];
    render(<SkillsClient initialSkills={skillsWithNull} />, { wrapper: TestWrapper });
    // The card renders even when iconEmoji is null; the emoji only affects category filtering
    expect(screen.getByRole("heading", { name: "Null Emoji Skill" })).toBeInTheDocument();
  });

  it("skill card shows 'anonymous' when authorName is null", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    expect(screen.getByText(new RegExp(zh.common.anonymous))).toBeInTheDocument();
  });

  it("skill cards display numeric star ratings", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    const ratings = screen.getAllByText(/\d+\.\d+/);
    expect(ratings.length).toBeGreaterThan(0);
    const texts = ratings.map((el) => el.textContent);
    // Avatar Creator: 300/100 = 3.0, Music Mixer: 100/100 = 1.0, Photo Filter: 0/0 = NaN (excluded)
    expect(texts.some((t) => t.includes("3.0"))).toBe(true);
    expect(texts.some((t) => t.includes("1.0"))).toBe(true);
  });

  it("renders correct number of skill cards", () => {
    render(<SkillsClient initialSkills={FAKE_SKILLS} />, { wrapper: TestWrapper });
    expect(skillHeadings().length).toBe(3);
  });
});
