# Getting Wot Da Fill found: accounts and listings

The site side is done: pre-rendered pages in both languages, the sitemap, FAQ data, `llms.txt`, and an IndexNow ping after every `pnpm deploy`. What's left needs your accounts, so it's written here ready to paste. Everything uses plain keyboard characters so it pastes cleanly anywhere.

Facts to keep straight in any listing: free, no sign-up, works in the browser, the list never leaves the device, designs are JPG/PNG/WebP, lists are pasted or XLSX/XLS/ODS/CSV/TSV, output is one picture per name in a zip (no PDF), English and Vietnamese. The repo has no license file, so don't call it open source until it has one.

## 1. Search engines (once, about 15 minutes)

**Google Search Console** (search.google.com/search-console)
1. Add property, **Domain**, `wotda.app`. Choose Cloudflare when asked about the DNS provider and it adds the TXT record for you.
2. Sitemaps: submit `https://fill.wotda.app/sitemap.xml`.
3. URL inspection: paste each of the 10 page addresses (they're in the sitemap) and press **Request indexing**. It speeds up the first crawl.

**Bing Webmaster Tools** (bing.com/webmasters)
1. Sign in and choose **Import from Google Search Console**. That brings the site and the sitemap across. ChatGPT search leans on Bing, so this one matters.
2. After that, `pnpm deploy` tells Bing about changes on its own (IndexNow).

## 2. GitHub repo

Done: the repo has these topics, so it shows up in GitHub search.

`mail-merge` `bulk-image-generator` `certificate-generator` `name-badge` `invitation` `wedding` `excel` `vietnamese` `cloudflare-workers` `react`

## 3. Product Hunt

- **Name:** Wot Da Fill
- **Tagline (60 max):** Put every name from a list on your design, in your browser
- **Description (260 max):** Add your invitation, certificate or name badge as a picture, paste your list or drop an Excel file, and download one finished card per name in a zip. Free, no sign-up, and the list never leaves your device. In English and Vietnamese.
- **Topics:** Design Tools, Productivity, Events, Education
- **Links:** https://fill.wotda.app and https://github.com/fongfan999/wot-da-fill
- **Gallery:** `public/og.png`, then screenshots of the editor, the names tab, and the finished-cards dialog.
- **First comment (maker):**

> Hi! I built Wot Da Fill after watching someone type 200 guest names into a wedding invitation, one by one, then export each card by hand.
>
> Now it's: add the design, paste the list, drag the name into place, download. Long names shrink to fit and you're told which ones to check. Extra columns like table numbers work too.
>
> Everything happens in your browser, so the guest list is never uploaded anywhere. No account, no watermark.
>
> I'd love to hear what you'd make with it, and what's missing.

The story in the first line is a placeholder; swap in what really made you build it.

## 4. AlternativeTo

- **Name:** Wot Da Fill
- **Description:** Free web app that puts each name from a list onto a copy of your design. Add an invitation, certificate or name badge as a picture, paste the list or drop an Excel or CSV file, place the name, and download one picture per person in a zip. Runs in the browser; the list is never uploaded.
- **Platform:** Online (web app). **License:** Free.
- **Add as an alternative to:** Canva (Bulk Create), Microsoft Word (mail merge), Adobe InDesign (data merge), Adobe Express.
- **Tags:** mail-merge, certificates, invitations, name-badges, bulk-editing, privacy-focused

## 5. Communities

Post where people ask the question, answer it properly, and link only when it fits. Most groups remove drive-by links.

**Vietnamese Facebook groups** (teachers, wedding planning, event organizers, HR):

> Mình vừa làm một công cụ nhỏ, miễn phí: điền tên hàng loạt lên thiệp mời, giấy khen, thẻ tên.
>
> Cách dùng: thêm ảnh thiết kế (đã chừa trống chỗ ghi tên), dán danh sách hoặc thả tệp Excel, kéo ô tên vào đúng chỗ, rồi tải về mỗi người một ảnh trong một tệp zip. Tên dài tự thu nhỏ cho vừa, có thêm cột số bàn hay lớp cũng được.
>
> Không cần đăng ký, danh sách không bị tải lên đâu cả vì mọi thứ chạy ngay trong trình duyệt. Phông SVN-, UTM- dùng được.
>
> https://fill.wotda.app/vi/
>
> Mọi người dùng thử và góp ý giúp mình nhé!

For a teachers' group, link https://fill.wotda.app/vi/dien-ten-giay-khen instead; for a wedding group, https://fill.wotda.app/vi/dien-ten-thiep-moi.

**Reddit, r/SideProject:**

> **Title:** I made a free tool that puts every name from a list onto your invitation or certificate
>
> You add the design as a picture, paste the names (or drop an Excel/CSV file), drag the name into place, and download one card per person in a zip. It runs entirely in the browser, so the list never gets uploaded, and there's no sign-up.
>
> Built with React and Cloudflare Workers; the image compression is MozJPEG/OxiPNG in WebAssembly, in a worker pool.
>
> https://fill.wotda.app. Feedback very welcome, especially on the editor.

Elsewhere on Reddit (r/weddingplanning, r/Teachers, r/eventplanning), only answer threads that ask how to do this, with the steps first and the link last.

**Show HN** (Tuesday to Thursday morning, US time, does best):

> **Title:** Show HN: Wot Da Fill - mail merge for pictures, entirely in the browser

## 6. Your own site and a short video

- wotdafong.dev already links to the app from its products page. A short post there about why you built it gives AI assistants and search engines a second, independent page describing it. (Write it in your own voice, per that repo's `docs/writing-voice.md`.)
- A 30 to 60 second screen recording (add design, paste names, download zip) does well on YouTube Shorts, TikTok and Facebook Reels. Title it with the problem, e.g. "Put 200 guest names on a wedding invitation in one minute", and link the page for that problem in the description.

## 7. Check in after 4 to 6 weeks

In Search Console's Performance report, look at which searches show the pages, and which pages get impressions but few clicks (rewrite those titles and descriptions in `src/client/lib/pages.ts`). Searches with no matching page are candidates for the next problem page.
