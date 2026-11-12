import type { ExampleKind } from "./example";
import type { Lang } from "./i18n";

/**
 * The site's pages: the home page, and one page for each problem people search for (adding guest
 * names to invitations, names on certificates, and so on). Every page exists in both languages
 * at its own address, is pre-rendered by scripts/prerender.mjs and listed in the sitemap. A problem
 * page is the home page with its own heading, a few words on that use, and its own questions.
 *
 * Only types come from other modules: i18n.tsx reads this file while it starts.
 */
export type PageId = "home" | "invitations" | "certificates" | "badges" | "mail-merge";
export type UseId = Exclude<PageId, "home">;

export const USE_IDS: UseId[] = ["invitations", "certificates", "badges", "mail-merge"];
export const PAGE_IDS: PageId[] = ["home", ...USE_IDS];

/** Each page's address in each language. Home pages end in a slash; the rest don't. */
export const PAGE_PATH: Record<PageId, Record<Lang, string>> = {
	home: { en: "/", vi: "/vi/" },
	invitations: { en: "/invitation-names", vi: "/vi/dien-ten-thiep-moi" },
	certificates: { en: "/certificate-names", vi: "/vi/dien-ten-giay-khen" },
	badges: { en: "/name-badges", vi: "/vi/the-ten-tu-excel" },
	"mail-merge": { en: "/mail-merge-images", vi: "/vi/tron-thu-hinh-anh" },
};

/** The home page in each language. */
export const HOME_PATH = PAGE_PATH.home;

const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

/** Which page an address is, and in which language; null for anything else (share links, typos). */
export function pageFromPath(path: string): { id: PageId; lang: Lang } | null {
	const p = trim(path);
	for (const id of PAGE_IDS) {
		for (const lang of ["en", "vi"] as const) if (trim(PAGE_PATH[id][lang]) === p) return { id, lang };
	}
	return null;
}

/** The language a page's address asks for, or null for an address that isn't one of the pages. */
export function langFromPath(path: string): Lang | null {
	return pageFromPath(path)?.lang ?? null;
}

/** The example each problem page shows first. */
export const USE_KIND: Record<UseId, ExampleKind> = {
	invitations: "invitation",
	certificates: "certificate",
	badges: "badge",
	"mail-merge": "invitation",
};

export interface UseCopy {
	/** Its name in the links between pages. */
	nav: string;
	/** The browser tab and search result title. */
	title: string;
	/** The search result text and social card description. */
	description: string;
	h1: string;
	lead: string;
	/** What it handles for this use, as title and text. */
	about: { title: string; points: [string, string][] };
	/** Questions people ask, answered plainly (also given to search engines as FAQPage data). */
	faq: [string, string][];
}

export const USE_COPY: Record<UseId, Record<Lang, UseCopy>> = {
	invitations: {
		en: {
			nav: "Guest names on invitations",
			title: "Add guest names to invitations in bulk · Wot Da Fill",
			description:
				"Put every guest’s name on your wedding or event invitation at once. Add your design, paste the guest list or an Excel file, and download one invitation per guest. Free, no sign-up.",
			h1: "Put every guest’s name on your invitations",
			lead: "Add your invitation design, paste the guest list or drop an Excel file, and download one finished invitation per guest, each named after them.",
			about: {
				title: "Made for wedding and event invitations",
				points: [
					["Names, titles and table numbers", "Write the text as you would say it, like “Dear {Name}” or “Table {Table}”. Any column of your list can go on the card."],
					["Fonts that suit an invitation", "Pick from script and serif fonts chosen for invitations, search all of Google Fonts, or add your own font file."],
					["Ready to send", "Each invitation is its own picture, sharp but small, so it is quick to send by message or email."],
				],
			},
			faq: [
				[
					"How do I add names to a wedding invitation in bulk?",
					"Add a picture of your invitation with the name left blank, paste your guest list or drop an Excel or CSV file, drag the name box into place, and press Make. You get every invitation in one zip, one picture per guest.",
				],
				[
					"Can I add a table number or a title like Mr and Mrs?",
					"Yes. Any column in your list can go on the card. Put titles in their own column, or write them into the text, such as “Mr & Mrs {Name}”.",
				],
				[
					"Will long names fit?",
					"Long names shrink to fit their box, and before you download you are shown any name that had to shrink a lot, so you can check it.",
				],
				[
					"Can I print the invitations?",
					"Yes. Invitations come out as pictures in the same format and size as your design (JPG, PNG or WebP), ready for a print shop or a home printer. There is no PDF download.",
				],
				[
					"Is my guest list uploaded anywhere?",
					"No. The invitations are made in your browser and the list never leaves your device. It is free, and there is no account to make.",
				],
			],
		},
		vi: {
			nav: "Điền tên lên thiệp mời",
			title: "Điền tên khách mời lên thiệp hàng loạt · Wot Da Fill",
			description:
				"Điền tên từng khách mời lên thiệp cưới, thiệp mời sự kiện cùng một lúc. Thêm thiết kế, dán danh sách khách hoặc tệp Excel, rồi tải về thiệp riêng cho từng người. Miễn phí, không cần đăng ký.",
			h1: "Điền tên từng khách mời lên thiệp",
			lead: "Thêm thiết kế thiệp mời, dán danh sách khách hoặc thả tệp Excel, rồi tải về thiệp hoàn chỉnh cho từng khách, mỗi tấm đặt tên theo người nhận.",
			about: {
				title: "Dành cho thiệp cưới và thiệp mời sự kiện",
				points: [
					["Tên, danh xưng và số bàn", "Viết nội dung như cách bạn vẫn ghi, ví dụ “Kính mời {Họ tên}” hay “Bàn {Bàn}”. Cột nào trong danh sách cũng đưa lên thiệp được."],
					["Phông chữ hợp với thiệp", "Chọn trong các phông thư pháp và có chân đã chọn sẵn cho thiệp mời, tìm trong toàn bộ Google Fonts, hoặc thêm phông của bạn (phông SVN-, UTM- đều dùng được)."],
					["Gửi qua Zalo, Messenger", "Mỗi thiệp là một ảnh riêng, nhẹ mà vẫn sắc nét, gửi qua Zalo, Messenger hay email đều nhanh."],
				],
			},
			faq: [
				[
					"Làm sao để điền tên hàng loạt lên thiệp cưới?",
					"Thêm ảnh thiệp đã chừa trống chỗ ghi tên, dán danh sách khách hoặc thả tệp Excel, CSV, kéo ô tên vào đúng chỗ rồi bấm Tạo thiệp. Bạn nhận về một tệp zip, mỗi khách một ảnh thiệp.",
				],
				[
					"Có ghi được số bàn hay danh xưng như Anh, Chị không?",
					"Được. Cột nào trong danh sách cũng đưa lên thiệp được. Để danh xưng ở một cột riêng, hoặc viết thẳng vào nội dung, ví dụ “Kính mời {Danh xưng} {Họ tên}”.",
				],
				[
					"Tên dài có bị tràn khỏi thiệp không?",
					"Không. Tên dài tự thu nhỏ cho vừa ô, và trước khi tải về bạn được báo những tên phải thu nhỏ nhiều để xem lại.",
				],
				[
					"In thiệp được không?",
					"Được. Thiệp được xuất ra dạng ảnh cùng định dạng và kích thước với thiết kế (JPG, PNG hoặc WebP), mang ra tiệm in hay in ở nhà đều được. Hiện chưa có bản PDF.",
				],
				[
					"Danh sách khách mời có bị tải lên mạng không?",
					"Không. Thiệp được tạo ngay trong trình duyệt, danh sách không rời khỏi thiết bị của bạn. Miễn phí và không cần tạo tài khoản.",
				],
			],
		},
	},
	certificates: {
		en: {
			nav: "Names on certificates",
			title: "Add names to certificates in bulk · Wot Da Fill",
			description:
				"Make a certificate for every student, participant or employee from one design and a list of names. Paste the list or drop an Excel file and download every certificate in one zip. Free, no sign-up.",
			h1: "A certificate for every name on your list",
			lead: "Add your certificate design, paste the names or drop an Excel file, and download one finished certificate per person. For classes, courses, events and awards.",
			about: {
				title: "Made for a whole class at once",
				points: [
					["Name, course and date", "Add a text box for each line that changes, such as the name, the course or a result, and fill it from the matching column of your list."],
					["Numbered certificates", "Insert the card number to give every certificate its own number, counting from 1, for your records."],
					["Accents come through", "Names with accents, Vietnamese included, come through correctly from Excel and CSV files, whatever encoding they were saved in."],
				],
			},
			faq: [
				[
					"How do I put names on many certificates at once?",
					"Add your certificate design as a picture, paste the list of names or drop an Excel or CSV file, place the name where it belongs, and press Make. Every certificate downloads in one zip, each file named after its person.",
				],
				[
					"Can I add more than the name, like the course or a date?",
					"Yes. Drag on an empty spot to add another text box, and fill it from any column of your list, such as {Course} or {Date}. Dates from Excel come out as dd/mm/yyyy.",
				],
				[
					"How many certificates can I make?",
					"As many as your list has names; there is no set limit. A few hundred usually take a minute or two, depending on your device.",
				],
				[
					"Can I use my school’s or company’s font?",
					"Yes. Add your own TTF, OTF or WOFF font file, or choose from all of Google Fonts.",
				],
				[
					"Is it free?",
					"Yes, with no sign-up and no watermark. The list of names stays on your device.",
				],
			],
		},
		vi: {
			nav: "Điền tên lên giấy khen",
			title: "Điền tên lên giấy khen, giấy chứng nhận hàng loạt · Wot Da Fill",
			description:
				"Tạo giấy khen, giấy chứng nhận cho cả lớp, cả khóa học từ một thiết kế và danh sách tên. Dán danh sách hoặc thả tệp Excel, tải về tất cả trong một tệp zip. Miễn phí, không cần đăng ký.",
			h1: "Giấy khen, giấy chứng nhận cho từng người trong danh sách",
			lead: "Thêm thiết kế giấy khen hay giấy chứng nhận, dán danh sách tên hoặc thả tệp Excel, rồi tải về bản hoàn chỉnh cho từng người. Dùng cho lớp học, khóa học, sự kiện và khen thưởng.",
			about: {
				title: "Làm cho cả lớp trong một lần",
				points: [
					["Tên, lớp, khóa học và ngày", "Thêm một ô chữ cho mỗi dòng cần thay đổi, như họ tên, lớp hay thành tích, và điền từ cột tương ứng trong danh sách."],
					["Đánh số từng tờ", "Chèn số thứ tự để mỗi tờ có một số riêng, đếm từ 1, tiện cho việc lưu sổ."],
					["Tiếng Việt có dấu hiển thị đúng", "Tên có dấu được giữ nguyên dù tệp Excel hay CSV được lưu theo kiểu mã hóa nào, kể cả Windows-1258."],
				],
			},
			faq: [
				[
					"Làm sao để điền tên lên nhiều giấy khen cùng lúc?",
					"Thêm ảnh thiết kế giấy khen, dán danh sách tên hoặc thả tệp Excel, CSV, đặt ô tên vào đúng chỗ rồi bấm Tạo. Tất cả được tải về trong một tệp zip, mỗi tệp đặt tên theo người nhận.",
				],
				[
					"Ngoài tên, có điền thêm lớp, khóa học hay ngày được không?",
					"Được. Kéo trên một chỗ trống để thêm ô chữ, rồi điền từ bất kỳ cột nào, ví dụ {Lớp} hay {Ngày}. Ngày trong Excel được ghi theo dạng dd/mm/yyyy.",
				],
				[
					"Làm được bao nhiêu tờ?",
					"Danh sách có bao nhiêu tên thì làm bấy nhiêu, không giới hạn. Vài trăm tờ thường mất khoảng một, hai phút, tùy máy.",
				],
				[
					"Dùng phông chữ riêng của trường, công ty được không?",
					"Được. Thêm tệp phông TTF, OTF hay WOFF của bạn (phông SVN-, UTM- đều dùng được), hoặc chọn trong toàn bộ Google Fonts.",
				],
				[
					"Có mất phí không?",
					"Không. Miễn phí, không cần đăng ký, không đóng dấu bản quyền. Danh sách tên chỉ ở trên thiết bị của bạn.",
				],
			],
		},
	},
	badges: {
		en: {
			nav: "Name badges from Excel",
			title: "Make name badges from an Excel list · Wot Da Fill",
			description:
				"Turn an Excel or CSV list into a name badge for every attendee, with name, company and role. Add your badge design, drop the file, and download every badge at once. Free, no sign-up.",
			h1: "Name badges for everyone on your Excel list",
			lead: "Add your badge design, drop your Excel or CSV file, and download a finished badge for every attendee, with their name, company and role where you want them.",
			about: {
				title: "From spreadsheet to badges",
				points: [
					["Straight from your spreadsheet", "Drop an XLSX, XLS, ODS, CSV or TSV file, or paste cells from Excel or Google Sheets. Headings are picked up for you."],
					["Name, company and role", "Each column can have its own text box, with its own font, size and colour."],
					["Every name fits", "Long names and company names shrink to fit their box, and you are told which ones to check."],
				],
			},
			faq: [
				[
					"How do I make name badges from an Excel file?",
					"Add a picture of your badge design, drop your Excel file on the Names tab, and choose which column goes in each text box. Press Make to download every badge in one zip.",
				],
				[
					"My file has several sheets. Which one is used?",
					"If more than one sheet has names, you choose the sheet. Headings are worked out automatically, and you can correct the guess.",
				],
				[
					"Can I print the badges?",
					"Yes. Badges come out as pictures the same size as your design, ready to print. To fit several on a page, choose several pictures per sheet when you print.",
				],
				[
					"Is my attendee list uploaded?",
					"No. The badges are made in your browser and the list never leaves your device.",
				],
			],
		},
		vi: {
			nav: "Làm thẻ tên từ Excel",
			title: "Làm thẻ tên hàng loạt từ danh sách Excel · Wot Da Fill",
			description:
				"Biến danh sách Excel hay CSV thành thẻ tên cho từng người tham dự, với họ tên, công ty, chức vụ. Thêm thiết kế thẻ, thả tệp, tải về tất cả cùng lúc. Miễn phí, không cần đăng ký.",
			h1: "Thẻ tên cho mọi người trong danh sách Excel",
			lead: "Thêm thiết kế thẻ tên, thả tệp Excel hoặc CSV, rồi tải về thẻ hoàn chỉnh cho từng người tham dự, với họ tên, công ty và chức vụ đặt đúng chỗ.",
			about: {
				title: "Từ bảng tính thành thẻ tên",
				points: [
					["Lấy thẳng từ bảng tính", "Thả tệp XLSX, XLS, ODS, CSV hay TSV, hoặc dán các ô sao chép từ Excel, Google Sheets. Tiêu đề cột được nhận ra tự động."],
					["Họ tên, công ty, chức vụ", "Mỗi cột có thể có ô chữ riêng, với phông, cỡ chữ và màu riêng."],
					["Tên nào cũng vừa", "Tên người và tên công ty dài tự thu nhỏ cho vừa ô, và bạn được báo những tên cần xem lại."],
				],
			},
			faq: [
				[
					"Làm sao để làm thẻ tên từ tệp Excel?",
					"Thêm ảnh thiết kế thẻ tên, thả tệp Excel vào thẻ Danh sách, rồi chọn cột nào điền vào ô chữ nào. Bấm Tạo để tải về tất cả thẻ trong một tệp zip.",
				],
				[
					"Tệp có nhiều trang tính thì dùng trang nào?",
					"Nếu có hơn một trang tính chứa tên, bạn được chọn trang. Tiêu đề cột được nhận ra tự động, và bạn có thể sửa nếu đoán sai.",
				],
				[
					"In thẻ tên được không?",
					"Được. Thẻ được xuất ra dạng ảnh đúng kích thước thiết kế, sẵn sàng để in. Muốn in nhiều thẻ trên một tờ, hãy chọn in nhiều ảnh trên một trang khi in.",
				],
				[
					"Danh sách người tham dự có bị tải lên không?",
					"Không. Thẻ được tạo trong trình duyệt và danh sách không rời khỏi thiết bị của bạn.",
				],
			],
		},
	},
	"mail-merge": {
		en: {
			nav: "Mail merge onto a picture",
			title: "Mail merge names onto an image · Wot Da Fill",
			description:
				"Mail merge for pictures: put each name from a list onto a copy of your design and download them all. Works with JPG, PNG and WebP designs from Canva, Photoshop or anywhere. Free, no sign-up.",
			h1: "Mail merge names onto a picture",
			lead: "Have a design as a picture and a list of names? Add both, place the name, and download one picture per name. Like mail merge, but for images.",
			about: {
				title: "When a document mail merge isn’t the right tool",
				points: [
					["Any picture as the design", "Export your design from Canva, Photoshop, Figma or anything else as JPG, PNG or WebP, with the name left blank."],
					["One file per name", "Every picture is named after its person, and a list in the zip shows which file belongs to whom."],
					["Keeps your design’s quality", "Pictures keep your design’s size and format, compressed so they stay sharp and small."],
				],
			},
			faq: [
				[
					"How do I mail merge names onto an image?",
					"Add your design as a JPG, PNG or WebP picture, paste your list or drop an Excel or CSV file, place the text where it belongs, and download every picture in one zip.",
				],
				[
					"Can I use a design from Canva?",
					"Yes. Download your Canva design as a PNG or JPG with the name left blank, then add it here and fill in your list.",
				],
				[
					"Can I fill in more than one field?",
					"Yes. Add as many text boxes as you need, each filled from a column of your list, such as name, table and date.",
				],
				[
					"Is it free and private?",
					"Yes. No account and no watermark, and the list never leaves your device: everything is made in your browser.",
				],
			],
		},
		vi: {
			nav: "Trộn thư vào hình ảnh",
			title: "Trộn thư danh sách tên vào hình ảnh · Wot Da Fill",
			description:
				"Trộn thư cho hình ảnh: điền từng tên trong danh sách lên một bản sao của thiết kế và tải về tất cả. Dùng với thiết kế JPG, PNG, WebP từ Canva, Photoshop hay bất cứ đâu. Miễn phí, không cần đăng ký.",
			h1: "Trộn thư danh sách tên vào hình ảnh",
			lead: "Có sẵn thiết kế dạng ảnh và một danh sách tên? Thêm cả hai, đặt vị trí tên, rồi tải về mỗi người một ảnh. Giống trộn thư trong Word, nhưng cho hình ảnh.",
			about: {
				title: "Khi trộn thư trong Word không phù hợp",
				points: [
					["Ảnh nào cũng làm thiết kế được", "Xuất thiết kế từ Canva, Photoshop, Figma hay bất kỳ đâu ra JPG, PNG hoặc WebP, chừa trống chỗ ghi tên."],
					["Mỗi người một tệp", "Mỗi ảnh được đặt tên theo người nhận, và trong tệp zip có danh sách cho biết tệp nào của ai."],
					["Giữ nguyên chất lượng thiết kế", "Ảnh giữ kích thước và định dạng của thiết kế, được nén để vừa nhẹ vừa sắc nét."],
				],
			},
			faq: [
				[
					"Làm sao để trộn thư danh sách tên vào ảnh?",
					"Thêm thiết kế dạng ảnh JPG, PNG hoặc WebP, dán danh sách hoặc thả tệp Excel, CSV, đặt chữ vào đúng chỗ, rồi tải về tất cả ảnh trong một tệp zip.",
				],
				[
					"Dùng thiết kế từ Canva được không?",
					"Được. Tải thiết kế Canva về dạng PNG hoặc JPG, chừa trống chỗ ghi tên, rồi thêm vào đây và điền danh sách.",
				],
				[
					"Điền nhiều thông tin cùng lúc được không?",
					"Được. Thêm bao nhiêu ô chữ tùy ý, mỗi ô lấy từ một cột trong danh sách, như họ tên, số bàn hay ngày.",
				],
				[
					"Có miễn phí và riêng tư không?",
					"Có. Không cần tài khoản, không đóng dấu, và danh sách không rời khỏi thiết bị của bạn: mọi thứ được tạo ngay trong trình duyệt.",
				],
			],
		},
	},
};

/** A page's tab title in a language. */
export function pageTitle(id: PageId, lang: Lang, homeTitle: string): string {
	return id === "home" ? homeTitle : USE_COPY[id][lang].title;
}
