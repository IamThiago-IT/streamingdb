export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: "/api/" },
    ],
    sitemap: "https://streamingdb.app/sitemap.xml",
  };
}
