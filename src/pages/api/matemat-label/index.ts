import { generateLabel } from "./generate-label";
import { type NextApiRequest, type NextApiResponse } from "next";

export default async function handler(
  requestEvent: NextApiRequest,
  res: NextApiResponse<{ error: string } | Buffer>,
) {
  const endpoint = process.env.NEXT_PUBLIC_GENERATOR_URL!;
  if (!endpoint) {
    throw new Error("NEXT_PUBLIC_GENERATOR_URL env is not set");
  }

  const username = process.env.NEXT_PUBLIC_GENERATOR_USER!;
  if (!username) {
    throw new Error("NEXT_PUBLIC_GENERATOR_USER env is not set");
  }

  const password = process.env.NEXT_PUBLIC_GENERATOR_PASS!;
  if (!password) {
    throw new Error("NEXT_PUBLIC_GENERATOR_PASS env is not set");
  }

  const svgTemplateFileName = "label_template.svg";

  const imageResponse = await generateLabel(
    svgTemplateFileName,
    requestEvent.query as Record<string, string>,
    {
      endpoint,
      username,
      password,
    },
  ).catch((error) => {
    console.error("Failed to generate OG image", error);
    res.status(500).json({ error: "Failed to generate OG image" });
  });

  if (!imageResponse) {
    res.status(500).json({ error: "Failed to generate OG image" });
    return;
  }

  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=172800");
  console.log("generation done");
  console.log(imageResponse);

  res.status(200).send(Buffer.from(await imageResponse.arrayBuffer()));
}
