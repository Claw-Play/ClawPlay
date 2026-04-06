import { render, screen, fireEvent, act } from "@testing-library/react";
import { SkillsGrid } from "../SkillsGrid";

const FAKE_SKILLS = [
  {
    slug: "avatar-creator",
    name: "Avatar Creator",
    summary: "Make beautiful avatars in seconds",
    authorName: "Alice",
    iconEmoji: "🎨",
    statsStars: 3,
    createdAt: new Date("2025-01-01"),
  },
  {
    slug: "music-mixer",
    name: "Music Mixer",
    summary: "Mix audio tracks with AI",
    authorName: "Bob",
    iconEmoji: "🎵",
    statsStars: 1,
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

const ALL_EMOJIS = ["🎨", "🎵", "🌍"];

describe("SkillsGrid — emoji filter", () => {
  it("renders all skills when no emoji filter is active", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(3);
  });

  it("renders only matching emoji skills when filter is active", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const emojiBtn = screen.getByRole("button", { name: "🎨" });
    act(() => { emojiBtn.click(); });
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(2);
  });

  it("clicking an active emoji filter deselects it (shows all)", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const emojiBtn = screen.getByRole("button", { name: "🎨" });
    act(() => { emojiBtn.click(); });
    expect(screen.getAllByRole("link").length).toBe(2);
    act(() => { emojiBtn.click(); });
    expect(screen.getAllByRole("link").length).toBe(3);
  });

  it("clicking 'All' button clears emoji filter", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const emojiBtn = screen.getByRole("button", { name: "🎨" });
    act(() => { emojiBtn.click(); });
    expect(screen.getAllByRole("link").length).toBe(2);
    const allBtn = screen.getByRole("button", { name: "All" });
    act(() => { allBtn.click(); });
    expect(screen.getAllByRole("link").length).toBe(3);
  });

  it("active 'All' button has gradient class", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const allBtn = screen.getByRole("button", { name: "All" });
    expect(allBtn.className).toContain("from-[#a23f00]");
    expect(allBtn.className).toContain("to-[#fa7025]");
  });

  it("active emoji button has gradient class", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const emojiBtn = screen.getByRole("button", { name: "🎨" });
    act(() => { emojiBtn.click(); });
    expect(emojiBtn.className).toContain("from-[#a23f00]");
  });
});

describe("SkillsGrid — search", () => {
  it("filters by skill name (case-insensitive)", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const searchInput = screen.getByPlaceholderText(/search skills/i);
    fireEvent.change(searchInput, { target: { value: "avatar" } });
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(1);
    expect(links[0]).toHaveAttribute("href", "/skills/avatar-creator");
  });

  it("filters by summary text", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const searchInput = screen.getByPlaceholderText(/search skills/i);
    fireEvent.change(searchInput, { target: { value: "audio" } });
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(1);
    expect(links[0]).toHaveAttribute("href", "/skills/music-mixer");
  });

  it("filters by authorName", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const searchInput = screen.getByPlaceholderText(/search skills/i);
    fireEvent.change(searchInput, { target: { value: "Alice" } });
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(1);
    expect(links[0]).toHaveAttribute("href", "/skills/avatar-creator");
  });

  it("shows all skills when search is cleared", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const searchInput = screen.getByPlaceholderText(/search skills/i);
    fireEvent.change(searchInput, { target: { value: "avatar" } });
    expect(screen.getAllByRole("link").length).toBe(1);
    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getAllByRole("link").length).toBe(3);
  });

  it("emoji filter and search work together", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const emojiBtn = screen.getByRole("button", { name: "🎨" });
    act(() => { emojiBtn.click(); });
    const searchInput = screen.getByPlaceholderText(/search skills/i);
    fireEvent.change(searchInput, { target: { value: "photo" } });
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(1);
    expect(links[0]).toHaveAttribute("href", "/skills/photo-filter");
  });
});

describe("SkillsGrid — empty state", () => {
  it("shows empty state when no skills match filters", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const searchInput = screen.getByPlaceholderText(/search skills/i);
    fireEvent.change(searchInput, { target: { value: "xyzabc123" } });
    expect(screen.getByText(/no results for/i)).toBeInTheDocument();
  });

  it("shows search term in empty state message when searching", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const searchInput = screen.getByPlaceholderText(/search skills/i);
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });
    expect(screen.getByText(/no results for "nonexistent"/i)).toBeInTheDocument();
  });

  it("'Show all skills' button resets both filters", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const searchInput = screen.getByPlaceholderText(/search skills/i);
    fireEvent.change(searchInput, { target: { value: "avatar" } });
    expect(screen.getAllByRole("link").length).toBe(1);
    const resetBtn = screen.getByRole("button", { name: /show all skills/i });
    act(() => { resetBtn.click(); });
    expect(screen.getAllByRole("link").length).toBe(3);
    expect(searchInput).toHaveValue("");
  });
});

describe("SkillsGrid — card rendering", () => {
  it("skill card links to /skills/{slug}", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const avatarLink = screen.getByRole("link", { name: /avatar creator/i });
    expect(avatarLink).toHaveAttribute("href", "/skills/avatar-creator");
  });

  it("skill card shows emoji fallback to 🦐 when iconEmoji is null", () => {
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
    render(<SkillsGrid initialSkills={skillsWithNull} allEmojis={[]} />);
    expect(screen.getByText("🦐")).toBeInTheDocument();
  });

  it("skill card shows 'anonymous' when authorName is null", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const photoCard = screen.getByRole("link", { name: /photo filter/i });
    expect(photoCard.textContent).toContain("by anonymous");
  });

  it("skill card shows star count", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const avatarCard = screen.getByRole("link", { name: /avatar creator/i });
    expect(avatarCard.textContent).toContain("⭐ 3");
  });

  it("renders correct number of skill cards", () => {
    render(<SkillsGrid initialSkills={FAKE_SKILLS} allEmojis={ALL_EMOJIS} />);
    const cards = screen.getAllByRole("link");
    expect(cards.length).toBe(3);
  });
});
