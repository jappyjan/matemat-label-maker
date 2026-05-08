export interface GeneratorConnection {
  endpoint: string;
  username: string;
  password: string;
}

export async function generateLabelPng(
  svgUrl: string,
  generatorConnection: GeneratorConnection,
): Promise<Blob> {
  const params = new URLSearchParams({ svgUrl });
  const fullURL = `${generatorConnection.endpoint}?${params.toString()}`;
  const auth = `Basic ${Buffer.from(`${generatorConnection.username}:${generatorConnection.password}`).toString("base64")}`;
  const response = await fetch(fullURL, {
    method: "GET",
    headers: { Authorization: auth },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`og-image-generator ${response.status}: ${text}`);
  }
  return response.blob();
}
