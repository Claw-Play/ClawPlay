import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills, skillVersions } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import JSZip from "jszip";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  // Validate slug — prevent path traversal
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug." }, { status: 400 });
  }

  const skill = await db.query.skills.findFirst({
    where: and(
      eq(skills.slug, slug),
      isNull(skills.deletedAt),
      eq(skills.moderationStatus, "approved")
    ),
  });

  if (!skill) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  // Resolve version: ?version=x.y.z or latest
  const versionParam = request.nextUrl.searchParams.get("version");

  let skillVersion;
  if (versionParam) {
    skillVersion = await db.query.skillVersions.findFirst({
      where: and(
        eq(skillVersions.skillId, skill.id),
        eq(skillVersions.version, versionParam)
      ),
    });
    if (!skillVersion) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }
  } else {
    if (!skill.latestVersionId) {
      return NextResponse.json({ error: "No version available." }, { status: 404 });
    }
    skillVersion = await db.query.skillVersions.findFirst({
      where: eq(skillVersions.id, skill.latestVersionId),
    });
    if (!skillVersion) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }
  }

  // Build deterministic zip: SKILL.md + origin.json
  const zip = new JSZip();
  zip.file("SKILL.md", skillVersion.content);
  zip.file(
    "origin.json",
    JSON.stringify(
      {
        slug: skill.slug,
        name: skill.name,
        version: skillVersion.version,
        source: "clawplay",
        installedAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-${skillVersion.version}.zip"`,
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}
