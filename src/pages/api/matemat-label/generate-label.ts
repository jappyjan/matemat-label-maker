import { writeFileSync } from "fs";

interface GeneratorConnectionDetails {
  endpoint: string;
  username: string;
  password: string;
}

export async function generateLabel(
  svgTemplateFileName: string,
  placeholders: Record<string, string>,
  generatorConnectionDetails: GeneratorConnectionDetails,
): Promise<Blob | null> {
  try {
    const baseURL = process.env.NEXT_PUBLIC_BASE_URL!;
    const svgTemplateUrl = `${baseURL}/${svgTemplateFileName}`;

    console.log("connection", generatorConnectionDetails);

    const searchParams = new URLSearchParams();
    searchParams.append("svgUrl", svgTemplateUrl);
    Object.entries(placeholders).forEach(([key, value]) => {
      searchParams.append(key, value);
    });

    const basicAuthHeader = `Basic ${Buffer.from(`${generatorConnectionDetails.username}:${generatorConnectionDetails.password}`).toString("base64")}`;

    const fullImageURL =
      generatorConnectionDetails.endpoint + `?${searchParams.toString()}`;

    const response = await fetch(fullImageURL, {
      method: "GET",
      headers: {
        Authorization: basicAuthHeader,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to generate OG image (${fullImageURL}): ${response.statusText}`,
      );
    }

    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error("Failed to generate OG image", error);
    return null;
  }
}
