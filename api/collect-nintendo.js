export default async function handler(req, res) {
  try {
    const apiUrl =
      "https://www.nintendo.com/jp/topics/c/_/v0/posts/search";

    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    return res.status(200).json({
      success: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type"),
      length: text.length,
      isJson: data !== null,
      sample: data !== null ? data : text.slice(0, 1000)
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
