export default async function handler(req, res) {
  try {
    const url = "https://www.nintendo.com/jp/topics/";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = await response.text();

    return res.status(200).json({
      success: response.ok,
      status: response.status,
      length: html.length
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
