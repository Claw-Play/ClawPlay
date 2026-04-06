import { db } from "@/lib/db";
import { smsCodes } from "@/lib/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";

const CODE_TTL_MINUTES = 10;
const CODE_LENGTH = 6;

function generateCode(): string {
  return String(Math.floor(Math.random() * 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/**
 * Send an SMS verification code to the given phone number.
 * Writes the code to sms_codes table and calls Aliyun SMS API.
 *
 * Required env vars:
 *   ALIYUN_SMS_ACCESS_KEY_ID
 *   ALIYUN_SMS_ACCESS_KEY_SECRET
 *   ALIYUN_SMS_SIGN_NAME
 *   ALIYUN_SMS_TEMPLATE_CODE
 */
export async function sendSmsCode(phone: string): Promise<void> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  // Persist code first so we can verify even if send fails locally
  await db.insert(smsCodes).values({ phone, code, expiresAt });

  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;

  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Aliyun SMS not configured.");
    }
    // Dev: log code to console instead of sending
    console.log(`[sms/dev] Phone: ${phone}  Code: ${code}  (expires ${expiresAt.toISOString()})`);
    return;
  }

  await callAliyunSms({ phone, code, accessKeyId, accessKeySecret, signName, templateCode });
}

/**
 * Verify a code for the given phone number.
 * Marks the code as used on success.
 * Returns true if valid, false otherwise.
 */
export async function verifySmsCode(phone: string, code: string): Promise<boolean> {
  const now = new Date();
  const record = await db.query.smsCodes.findFirst({
    where: and(
      eq(smsCodes.phone, phone),
      eq(smsCodes.code, code),
      gt(smsCodes.expiresAt, now),
      isNull(smsCodes.usedAt)
    ),
  });

  if (!record) return false;

  await db
    .update(smsCodes)
    .set({ usedAt: now })
    .where(eq(smsCodes.id, record.id));

  return true;
}

// ---------------------------------------------------------------------------
// Aliyun SMS — HMAC-SHA1 signed REST API
// Docs: https://help.aliyun.com/document_detail/101414.html
// ---------------------------------------------------------------------------

interface AliyunSmsParams {
  phone: string;
  code: string;
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
}

async function callAliyunSms(p: AliyunSmsParams): Promise<void> {
  const { createHmac } = await import("crypto");

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const nonce = Math.random().toString(36).slice(2);

  const params: Record<string, string> = {
    AccessKeyId: p.accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: p.phone,
    RegionId: "cn-hangzhou",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: nonce,
    SignatureVersion: "1.0",
    SignName: p.signName,
    TemplateCode: p.templateCode,
    TemplateParam: JSON.stringify({ code: p.code }),
    Timestamp: timestamp,
    Version: "2017-05-25",
  };

  // Canonical sorted query string
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");

  const stringToSign = `POST&${encodeURIComponent("/")}&${encodeURIComponent(sorted)}`;
  const signature = createHmac("sha1", `${p.accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");

  const body = new URLSearchParams({ ...params, Signature: signature });

  const res = await fetch("https://dysmsapi.aliyuncs.com/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const json = (await res.json()) as { Code: string; Message: string };
  if (json.Code !== "OK") {
    throw new Error(`Aliyun SMS error: ${json.Code} — ${json.Message}`);
  }
}
