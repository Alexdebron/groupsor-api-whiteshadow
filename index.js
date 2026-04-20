const express = require("express");
const cors = require("cors");
const { load } = require("cheerio");
const cloudscraper = require("cloudscraper");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const base_url = "https://groupsor.link";
const CREATOR = "whiteshadow";

// --- Scraper Functions ---

async function warmupSession(keyword) {
  const url = `${base_url}/group/search?keyword=${encodeURIComponent(keyword)}`;
  await cloudscraper.get(url);
}

function parseGroups(html) {
  const $ = load(html);
  const groups = [];
  
  $("img.image").each((_, img) => {
    const $img = $(img);
    const $anchor = $img.closest("a");
    const $container = $anchor.closest("div");
    const $info = $container.next("div.post-info");
    
    const name = $img.attr("alt") || "";
    const photo = $img.attr("src") || "";
    const inviteUrl = $anchor.attr("href") || "";
    
    const $basic = $info.find("div.post-basic-info");
    const description = $basic.find("p.descri").text().trim();
    const joinUrl = ($info.find("span.joinbtn a.joinbtn").attr("href") || "").trim();
    
    groups.push({
      name,
      photo,
      invite_url: inviteUrl,
      join_url: joinUrl,
      description: description || "null"
    });
  });
  
  return groups;
}

async function fetchGroups(keyword, groupNo) {
  // සටහන: cloudscraper එකේ request body එකක් යවන්නේ බොහෝවිට POST මගින්, 
  // නමුත් ඔයාගේ මුල් code එකේ තියෙන විදිහටම යොදා ඇත.
  const res = await cloudscraper.get(
    `${base_url}/group/searchmore/${encodeURIComponent(keyword)}`,
    {
      body: `group_no=${groupNo}`,
    }
  );
  return parseGroups(res);
}

async function groupSearch(keyword, maxPages = 1) {
  const all = [];
  await warmupSession(keyword);
  
  for (let page = 0; page < maxPages; page++) {
    try {
      const groups = await fetchGroups(keyword, page);
      if (!groups.length) {
        break;
      }
      all.push(...groups);
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.log(err);
      break;
    }
  }
  return all;
}

// --- API Endpoints ---

// 1. Home / Status Route
app.get("/", (req, res) => {
  res.json({
    status: true,
    creator: CREATOR,
    message: "Groupsor Scraper API is running!"
  });
});

// 2. Search Groups Route
// උදාහරණ: /api/groups?q=Developer&pages=1
app.get("/api/groups", async (req, res) => {
  const query = req.query.q;
  const pages = parseInt(req.query.pages) || 1; // Default ලෙස page 1ක් පමණක් ගනී

  if (!query) {
    return res.status(400).json({
      status: false,
      creator: CREATOR,
      error: "Query parameter 'q' is required (e.g., ?q=Developer)"
    });
  }

  try {
    const results = await groupSearch(query, pages);
    res.status(200).json({
      status: true,
      creator: CREATOR,
      query: query,
      total: results.length,
      data: results
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      creator: CREATOR,
      error: err.message
    });
  }
});

// Local පරිගණකයේ run කරන විට පමණක් port 3000 භාවිතා කිරීම
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Vercel සඳහා App එක Export කිරීම
module.exports = app;
