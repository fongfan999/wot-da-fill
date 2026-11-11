import { useEffect, useState, type ReactNode } from "react";

/**
 * The site's language: English or Vietnamese. A first visit follows the browser; after that the
 * person's choice is remembered on this device. The example invitation follows it too. A
 * person's own design and list are never touched.
 */
export type Lang = "en" | "vi";

const KEY = "wdf:lang";
const listeners = new Set<(lang: Lang) => void>();

let current: Lang = (() => {
	try {
		const saved = localStorage.getItem(KEY);
		if (saved === "en" || saved === "vi") return saved;
	} catch {
		// Storage can be blocked; fall back to the browser's language.
	}
	return fromBrowser();
})();

/**
 * Vietnamese when the browser asks for it, or when the person appears to be in Vietnam: a
 * Vietnamese region on any of their languages (such as en-VN), or a Vietnamese time zone.
 * Everyone else gets English.
 */
function fromBrowser(): Lang {
	const langs = (navigator.languages?.length ? navigator.languages : [navigator.language]).map((l) => l.toLowerCase());
	if (langs.some((l) => l === "vi" || l.startsWith("vi-") || l.endsWith("-vn"))) return "vi";
	try {
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (zone === "Asia/Ho_Chi_Minh" || zone === "Asia/Saigon") return "vi";
	} catch {
		// No time zone information; English it is.
	}
	return "en";
}

export function getLang(): Lang {
	return current;
}

export function setLang(lang: Lang) {
	current = lang;
	try {
		localStorage.setItem(KEY, lang);
	} catch {
		// Storage can be blocked; the choice just lasts for this visit.
	}
	applyDocument(lang);
	listeners.forEach((l) => l(lang));
}

function applyDocument(lang: Lang) {
	document.documentElement.lang = lang;
	document.title = STRINGS[lang].docTitle;
}

/** The current language's strings, for code outside React (error messages from the libraries). */
export function tr(): Strings {
	return STRINGS[current];
}

/** The current language's strings; the component redraws when the language changes. */
export function useT(): Strings {
	return STRINGS[useLang()[0]];
}

export function useLang(): [Lang, (lang: Lang) => void] {
	const [lang, set] = useState(current);
	useEffect(() => {
		listeners.add(set);
		return () => void listeners.delete(set);
	}, []);
	return [lang, setLang];
}

const enNum = (n: number) => n.toLocaleString("en-US");
const viNum = (n: number) => n.toLocaleString("vi-VN");
const enList = (items: string[], word: "and" | "or") =>
	items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${word} ${items.at(-1)}`;
const viList = (items: string[], word: "and" | "or") =>
	items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${word === "and" ? "và" : "hoặc"} ${items.at(-1)}`;

const en = {
	docTitle: "Wot Da Fill · personalize a card for every name",
	num: enNum,
	nOfM: (a: number, b: number) => `${enNum(a)} of ${enNum(b)}`,
	language: "Language",
	darkTheme: "Dark theme",
	github: "Source code on GitHub",
	lightTheme: "Light theme",
	langName: { en: "English", vi: "Tiếng Việt" },

	// Steps and the editor frame
	steps: { design: "Design", names: "Names", text: "Text" },
	stepsLabel: "Steps",
	done: "Done",
	share: "Share",
	shareLayout: "Share this layout",
	more: "More",
	startOver: "Start over",
	undo: "Undo",
	redo: "Redo",
	prevName: "Previous name",
	nextName: "Next name",
	whichName: "Which name to show",
	empty: "empty",
	exampleName: "Example name",
	hideBoxes: "Hide the boxes",
	showBoxes: "Show the boxes",
	dismiss: "Dismiss",
	close: "Close",
	colourCode: "Colour code",
	madeBy: "Made by Wot Da Fong",
	editorLabel: "Your design. Drag on an empty spot to add a text box; arrow keys move the selected one.",
	cardPreview: "Card preview",
	tooLongTag: "too long",

	// Messages
	openingShared: "Opening the shared layout…",
	notPicture: "That file is not a picture. Use a JPG, PNG or WebP.",
	openingDesign: "Opening your design…",
	couldntOpenPicture: "Couldn't open that picture.",
	drawingExample: "Getting the example ready…",
	couldntDrawExample: "Couldn't open the example.",
	boxRemoved: "Text box removed.",
	fontAdded: (family: string) => `Added your font “${family}”.`,
	couldntReadFont: "Couldn't read that font.",
	cleared: "Everything cleared.",
	missingDesign: "Add your design first.",
	missingNames: "Add your names first.",
	missingBox: "Add a text box first.",
	showMe: "Show me",
	missingColumns: (cols: string[]): ReactNode => (
		<>
			Your list has no <b>{enList(cols, "or")}</b>, so that part of every card will be blank.
		</>
	),
	tooLong: (n: number, many: boolean, spills: boolean, shrinks: boolean): ReactNode => (
		<>
			<b>{n === 1 ? "1 name is" : `${enNum(n)} names are`} too long</b> for {many ? "their boxes" : "the box"}.{" "}
			{spills && shrinks
				? "Some come out much smaller than the others, some spill over."
				: spills
					? `${n === 1 ? "It spills" : "They spill"} over the edge.`
					: `${n === 1 ? "It comes" : "They come"} out much smaller than the others.`}
		</>
	),
	allFit: (n: number, many: boolean) => `All ${n === 1 ? "1 name fits" : `${enNum(n)} names fit`} in ${many ? "their boxes" : "the box"}.`,
	nextNames: "Next: Names",
	nextText: "Next: Text",
	makeCards: (n: number) => (n ? `Make ${n === 1 ? "1 card" : `${enNum(n)} cards`}` : "Make the cards"),
	hintNoBox: "Drag on the design to add a text box.",
	hintTextFine: "Drag the box to move it. Drag on an empty spot to add another. Arrow keys nudge it, Shift for 10px.",
	hintTextCoarse: "Drag the box to move it. Drag on an empty spot to add another.",
	hintPlace: "Drag the box to where the name belongs. Pull its corners to resize it.",

	// Design step
	designTitle: "Design",
	replaceDesign: "Replace the design",
	useDifferent: "Use a different picture",
	boxesStay: "Your text boxes stay where they are.",

	// Names step
	namesTitle: "Names",
	readingList: "Reading your list…",
	fileNoNames: "That file has no names in it.",
	couldntReadFile: "Couldn't read that file. Try saving it as Excel or CSV.",
	headings: "The first row is headings",
	replaceList: "Replace list",
	clear: "Clear",
	layoutUses: (cols: string[]): ReactNode => (
		<>
			This layout uses <b>{enList(cols, "and")}</b>. Add a list with those headings.
		</>
	),
	pasteLabel: "Paste your names, or drop a spreadsheet here",
	pasteHint: "One name per line, or copy cells from Excel or Google Sheets. Excel, CSV and Numbers files work too.",
	or: "Or",
	chooseSpreadsheet: "choose a spreadsheet file",
	trySampleNames: "try sample names",
	nameCount: (n: number) => (n === 1 ? "1 name" : `${enNum(n)} names`),
	from: "from",
	pastedList: "what you pasted",
	sampleList: "the sample list",
	rowNo: "No.",
	showThisName: "Show this name on the design",
	andMore: (n: number) => `and ${enNum(n)} more. Every one gets a card.`,
	noNamesYet: "There are no names under the headings yet.",
	sheet: "Sheet",
	howSplit: "How the names are split",
	workItOut: (cells: boolean) => `Work it out (${cells ? "spreadsheet cells" : "one per line"})`,
	splitLine: "One name per line",
	splitTab: "Cells copied from a spreadsheet",
	splitComma: "Commas",
	splitSemicolon: "Semicolons",
	looksWrong: "Looks wrong?",

	// Text step
	textTitle: "Text",
	addText: "Add text",
	textBoxes: "Text boxes",
	cardNumber: "Card number",
	noBoxes: "Drag on the design to add a text box, or press Add text.",
	pickBox: "Pick a text box on the design to change it.",
	whatItSays: "What it says",
	unknownColumns: (cols: string[]) => `Your list has no ${enList(cols.map((c) => `“${c}”`), "or")}. Pick one of the buttons below or fix the spelling.`,
	addFromList: "Add from your list",
	font: "Font",
	size: "Size",
	colour: "Colour",
	lineUp: "Line up",
	alignLeft: "Left",
	alignCentre: "Centre",
	alignRight: "Right",
	moreOptions: "More options",
	thickness: "Thickness",
	weights: {
		100: "Thin",
		200: "Extra light",
		300: "Light",
		400: "Regular",
		500: "Medium",
		600: "Semibold",
		700: "Bold",
		800: "Extra bold",
		900: "Black",
		1000: "Extra black",
	} as Record<number, string>,
	slant: "Slant",
	upright: "Upright",
	italic: "Italic",
	capitals: "Capital letters",
	asTyped: "As typed",
	eachWord: "Each Word",
	allCaps: "ALL CAPS",
	letterSpacing: "Letter spacing",
	lineHeight: "Line height",
	vertical: "Top, middle or bottom",
	top: "Top",
	middle: "Middle",
	bottom: "Bottom",
	shrink: "Shrink long names to fit",
	shrinkHint: "Long names get smaller instead of spilling out of the box.",
	wrap: "Let text run onto more lines",
	wrapHint: "For addresses or long titles.",
	position: "Position and size",
	posLeft: "Left",
	posTop: "Top",
	posWidth: "Width",
	posHeight: "Height",
	centreOnDesign: "Centre on the design",
	duplicate: "Duplicate",
	remove: "Remove",

	// Font picker
	searchFontsPlaceholder: "Search 1,700+ fonts",
	searchFonts: "Search fonts",
	fonts: "Fonts",
	fontsFound: (n: number) => `${enNum(n)} found`,
	curatedFonts: "Picked for invitations, all with Vietnamese accents",
	loadingFonts: "Loading fonts…",
	noFontCalled: (q: string) => `No font called “${q}”.`,
	ownFont: "Use my own font file",
	noVietnamese: "No Vietnamese",
	yours: "Yours",

	// Making the cards
	wentWrong: "Something went wrong.",
	confirmStop: "Stop making the cards? The ones made so far will be thrown away.",
	cardsNotMade: "The cards weren't made",
	cardsReady: (n: number) => `Your ${n === 1 ? "card is" : `${enNum(n)} cards are`} ready`,
	makingCards: "Making your cards",
	stop: "Stop",
	backToEditing: "Back to editing",
	almostDone: "almost done",
	secondsLeft: (s: number) => `about ${s} seconds left`,
	minuteLeft: "about a minute left",
	minutesLeft: (m: number) => `about ${m} minutes left`,
	gettingFonts: "Getting the fonts ready",
	zipping: "Putting them in one zip",
	privacyRun: "Everything happens in this browser tab. Your list never leaves this device.",
	downloadStarted: "The download started by itself. Look in your Downloads folder.",
	downloadAgain: "Download again",
	cardsFailed: (n: number, rows: string): ReactNode => (
		<>
			<b>{n === 1 ? "1 card" : `${enNum(n)} cards`} couldn't be made</b> (number {rows}). The zip has all the others.
		</>
	),
	saveCard: (name: string) => `Save ${name}`,
	showMore: (n: number) => `Show more (${enNum(n)} left)`,
	details: "Details",
	statCards: "Cards",
	statZip: "Zip",
	statEach: "Each card",
	statTook: "Took",
	eachCard: (size: string, saved: number) => `about ${size}${saved > 0 ? `, ${saved}% smaller than your design` : ""}`,
	manifestNote: "The zip also has _manifest.csv, which says which file belongs to which name.",
	zipName: (base: string, n: number) => `${base}-${n}-cards.zip`,

	// Sharing
	shareFailed: "Sharing didn't work. Try again in a moment.",
	shareBody: "Anyone with the link gets your design, where the text goes and any fonts you added, then adds their own names.",
	shareNote: "Your list of names is never shared. It stays on this device.",
	shareLinkLabel: "Link to this layout",
	makingLink: "Making the link…",
	linkCopied: "Link copied",
	copyLink: "Copy link",
	sharedMissing: "This layout link doesn't exist, or it has expired.",
	sharedCouldntLoad: "Couldn't open this layout. Try again in a moment.",
	sharedImageMissing: "This layout's design is missing.",
	sharedFontMissing: (family: string) => `The font “${family}” is missing from this layout.`,

	// Errors from opening pictures and fonts
	cantOpenImage: "This browser can't open that picture. Use a JPG, PNG or WebP.",
	imageTooBig: "That picture is over 60 megapixels. Make it smaller first.",
	fontNoStyle: (family: string, weight: number, italic: boolean) => `“${family}” has no ${italic ? "italic " : ""}${weight} style.`,
	fontUnreadable: (family: string) => `Couldn't read the font “${family}”.`,
	notAFont: (file: string) => `“${file}” isn't a font file this browser can read.`,

	// Home page
	home: {
		tryExample: "Try an example",
		title: (accent: (word: string) => ReactNode): ReactNode => <>One design. A card for {accent("every")} name.</>,
		lead: "Add your invitation, certificate or name badge, paste your list, and download a finished card for each person. No typing names in one by one.",
		addDesign: "Add your design",
		dropTitle: "Drop your design here",
		dropHint: "JPG, PNG or WebP, with the name left blank.",
		choosePicture: "Choose a picture",
		ticks: ["Free", "No sign-up", "Your list never leaves this device"],
		stepsTitle: "Three steps, about a minute",
		step1: "Add your design",
		step1Text: "Any picture of your card with the name left blank. We put a name on it straight away so you can drag it into place.",
		nameGoesHere: "Name goes here",
		step2: "Add your names",
		step2Text: "Paste them, or drop an Excel or CSV file. One person per line; extra columns like table numbers work too.",
		step3: "Download every card",
		step3Text: "Pick a font and colour, then get one picture per person in a single zip, each file named after its guest.",
		trustTitle: "Made to be trusted with a guest list",
		facts: [
			["Your list stays with you", "The cards are made in your browser. Names are never uploaded anywhere."],
			["Long names fit", "Long names shrink to fit, and you are told which ones need a look before you download."],
			["Vietnamese looks right", "Accents are drawn properly, and fonts that cannot draw them are marked."],
			["Ready to send", "Cards are kept small without losing quality, so they are quick to share."],
		] as [string, string][],
		endTitle: "No design to hand?",
		endText: "Start from one of ours and swap in your own later. Each comes with a few names so you can see the whole thing work.",
		kinds: { invitation: "Invitation", certificate: "Certificate", badge: "Name badge" } as Record<"invitation" | "certificate" | "badge", string>,
		chooseExample: "Which example to show",
		pictureLabel: "An example design filled in with each name from a list, one after another",
		tryIt: "Try it",
	},
};

export type Strings = typeof en;

const vi: Strings = {
	docTitle: "Wot Da Fill · thiệp riêng cho từng người",
	num: viNum,
	nOfM: (a, b) => `${viNum(a)} / ${viNum(b)}`,
	language: "Ngôn ngữ",
	darkTheme: "Giao diện tối",
	github: "Mã nguồn trên GitHub",
	lightTheme: "Giao diện sáng",
	langName: en.langName,

	steps: { design: "Thiết kế", names: "Danh sách", text: "Chữ" },
	stepsLabel: "Các bước",
	done: "Xong",
	share: "Chia sẻ",
	shareLayout: "Chia sẻ bố cục này",
	more: "Thêm",
	startOver: "Làm lại từ đầu",
	undo: "Hoàn tác",
	redo: "Làm lại",
	prevName: "Tên trước",
	nextName: "Tên sau",
	whichName: "Tên đang hiển thị",
	empty: "trống",
	exampleName: "Tên mẫu",
	hideBoxes: "Ẩn các ô",
	showBoxes: "Hiện các ô",
	dismiss: "Đóng",
	close: "Đóng",
	colourCode: "Mã màu",
	madeBy: "Thực hiện bởi Wot Da Fong",
	editorLabel: "Thiết kế của bạn. Kéo ở chỗ trống để thêm ô chữ; phím mũi tên di chuyển ô đang chọn.",
	cardPreview: "Xem trước thiệp",
	tooLongTag: "quá dài",

	openingShared: "Đang mở bố cục được chia sẻ…",
	notPicture: "Tệp này không phải là ảnh. Hãy dùng ảnh JPG, PNG hoặc WebP.",
	openingDesign: "Đang mở thiết kế của bạn…",
	couldntOpenPicture: "Không mở được ảnh này.",
	drawingExample: "Đang chuẩn bị mẫu…",
	couldntDrawExample: "Không mở được mẫu.",
	boxRemoved: "Đã xoá ô chữ.",
	fontAdded: (family) => `Đã thêm phông chữ “${family}”.`,
	couldntReadFont: "Không đọc được phông chữ này.",
	cleared: "Đã xoá hết.",
	missingDesign: "Hãy thêm thiết kế trước.",
	missingNames: "Hãy thêm danh sách tên trước.",
	missingBox: "Hãy thêm một ô chữ trước.",
	showMe: "Xem",
	missingColumns: (cols) => (
		<>
			Danh sách của bạn không có cột <b>{viList(cols, "or")}</b>, nên phần đó trên mọi thiệp sẽ để trống.
		</>
	),
	tooLong: (n, many, spills, shrinks) => (
		<>
			<b>{viNum(n)} tên quá dài</b> so với {many ? "ô chữ của chúng" : "ô chữ"}.{" "}
			{spills && shrinks
				? "Có tên nhỏ hơn hẳn các tên khác, có tên tràn ra ngoài."
				: spills
					? "Chữ tràn ra ngoài mép ô."
					: "Chữ sẽ nhỏ hơn hẳn các tên khác."}
		</>
	),
	allFit: (n, many) => `Cả ${viNum(n)} tên đều vừa ${many ? "các ô chữ" : "ô chữ"}.`,
	nextNames: "Tiếp: Danh sách",
	nextText: "Tiếp: Chữ",
	makeCards: (n) => (n ? `Tạo ${viNum(n)} thiệp` : "Tạo thiệp"),
	hintNoBox: "Kéo trên thiết kế để thêm một ô chữ.",
	hintTextFine: "Kéo ô để di chuyển. Kéo ở chỗ trống để thêm ô khác. Phím mũi tên dịch từng chút, giữ Shift để dịch 10px.",
	hintTextCoarse: "Kéo ô để di chuyển. Kéo ở chỗ trống để thêm ô khác.",
	hintPlace: "Kéo ô đến chỗ cần ghi tên. Kéo các góc để đổi kích thước.",

	designTitle: "Thiết kế",
	replaceDesign: "Thay thiết kế",
	useDifferent: "Dùng ảnh khác",
	boxesStay: "Các ô chữ vẫn giữ nguyên chỗ.",

	namesTitle: "Danh sách",
	readingList: "Đang đọc danh sách…",
	fileNoNames: "Tệp này không có tên nào.",
	couldntReadFile: "Không đọc được tệp này. Hãy thử lưu lại dưới dạng Excel hoặc CSV.",
	headings: "Dòng đầu là tiêu đề cột",
	replaceList: "Thay danh sách",
	clear: "Xoá",
	layoutUses: (cols) => (
		<>
			Bố cục này dùng cột <b>{viList(cols, "and")}</b>. Hãy thêm danh sách có các tiêu đề đó.
		</>
	),
	pasteLabel: "Dán danh sách tên, hoặc thả tệp bảng tính vào đây",
	pasteHint: "Mỗi dòng một tên, hoặc sao chép ô từ Excel hay Google Sheets. Tệp Excel, CSV và Numbers cũng dùng được.",
	or: "Hoặc",
	chooseSpreadsheet: "chọn tệp bảng tính",
	trySampleNames: "dùng thử danh sách mẫu",
	nameCount: (n) => `${viNum(n)} tên`,
	from: "từ",
	pastedList: "danh sách bạn đã dán",
	sampleList: "danh sách mẫu",
	rowNo: "STT",
	showThisName: "Hiện tên này trên thiết kế",
	andMore: (n) => `và ${viNum(n)} tên nữa. Ai cũng sẽ có thiệp.`,
	noNamesYet: "Chưa có tên nào dưới dòng tiêu đề.",
	sheet: "Trang tính",
	howSplit: "Cách tách tên",
	workItOut: (cells) => `Tự nhận biết (${cells ? "ô bảng tính" : "mỗi dòng một tên"})`,
	splitLine: "Mỗi dòng một tên",
	splitTab: "Ô sao chép từ bảng tính",
	splitComma: "Dấu phẩy",
	splitSemicolon: "Dấu chấm phẩy",
	looksWrong: "Trông chưa đúng?",

	textTitle: "Chữ",
	addText: "Thêm chữ",
	textBoxes: "Các ô chữ",
	cardNumber: "Số thứ tự",
	noBoxes: "Kéo trên thiết kế để thêm ô chữ, hoặc bấm Thêm chữ.",
	pickBox: "Chọn một ô chữ trên thiết kế để chỉnh.",
	whatItSays: "Nội dung",
	unknownColumns: (cols) => `Danh sách của bạn không có cột ${viList(cols.map((c) => `“${c}”`), "or")}. Hãy chọn một nút bên dưới hoặc sửa lại chính tả.`,
	addFromList: "Thêm từ danh sách",
	font: "Phông chữ",
	size: "Cỡ chữ",
	colour: "Màu",
	lineUp: "Căn lề",
	alignLeft: "Trái",
	alignCentre: "Giữa",
	alignRight: "Phải",
	moreOptions: "Tuỳ chọn khác",
	thickness: "Độ đậm",
	weights: {
		100: "Rất mảnh",
		200: "Mảnh hơn",
		300: "Mảnh",
		400: "Thường",
		500: "Vừa",
		600: "Hơi đậm",
		700: "Đậm",
		800: "Rất đậm",
		900: "Đậm nhất",
		1000: "Cực đậm",
	},
	slant: "Kiểu chữ",
	upright: "Thẳng",
	italic: "Nghiêng",
	capitals: "Chữ hoa",
	asTyped: "Giữ nguyên",
	eachWord: "Hoa Đầu Từ",
	allCaps: "VIẾT HOA",
	letterSpacing: "Giãn chữ",
	lineHeight: "Giãn dòng",
	vertical: "Trên, giữa hay dưới",
	top: "Trên",
	middle: "Giữa",
	bottom: "Dưới",
	shrink: "Thu nhỏ tên dài cho vừa",
	shrinkHint: "Tên dài sẽ nhỏ lại thay vì tràn ra ngoài ô.",
	wrap: "Cho chữ xuống dòng",
	wrapHint: "Dành cho địa chỉ hoặc chức danh dài.",
	position: "Vị trí và kích thước",
	posLeft: "Trái",
	posTop: "Trên",
	posWidth: "Rộng",
	posHeight: "Cao",
	centreOnDesign: "Căn giữa thiết kế",
	duplicate: "Nhân bản",
	remove: "Xoá",

	searchFontsPlaceholder: "Tìm trong hơn 1.700 phông chữ",
	searchFonts: "Tìm phông chữ",
	fonts: "Phông chữ",
	fontsFound: (n) => `Tìm thấy ${viNum(n)}`,
	curatedFonts: "Chọn sẵn cho thiệp mời, đều có dấu tiếng Việt",
	loadingFonts: "Đang tải phông chữ…",
	noFontCalled: (q) => `Không có phông chữ nào tên “${q}”.`,
	ownFont: "Dùng tệp phông chữ của tôi",
	noVietnamese: "Không có dấu",
	yours: "Của bạn",

	wentWrong: "Đã có lỗi xảy ra.",
	confirmStop: "Dừng tạo thiệp? Những thiệp đã tạo sẽ bị bỏ đi.",
	cardsNotMade: "Chưa tạo được thiệp",
	cardsReady: (n) => `${viNum(n)} thiệp của bạn đã xong`,
	makingCards: "Đang tạo thiệp",
	stop: "Dừng",
	backToEditing: "Quay lại chỉnh sửa",
	almostDone: "sắp xong",
	secondsLeft: (s) => `còn khoảng ${s} giây`,
	minuteLeft: "còn khoảng 1 phút",
	minutesLeft: (m) => `còn khoảng ${m} phút`,
	gettingFonts: "Đang chuẩn bị phông chữ",
	zipping: "Đang gói vào một tệp zip",
	privacyRun: "Mọi thứ diễn ra ngay trong thẻ trình duyệt này. Danh sách của bạn không rời khỏi thiết bị.",
	downloadStarted: "Tệp đã tự tải xuống. Hãy xem trong thư mục Tải về.",
	downloadAgain: "Tải lại",
	cardsFailed: (n, rows) => (
		<>
			<b>{viNum(n)} thiệp không tạo được</b> (số {rows}). Tệp zip có đủ các thiệp còn lại.
		</>
	),
	saveCard: (name) => `Lưu ${name}`,
	showMore: (n) => `Xem thêm (còn ${viNum(n)})`,
	details: "Chi tiết",
	statCards: "Số thiệp",
	statZip: "Tệp zip",
	statEach: "Mỗi thiệp",
	statTook: "Thời gian",
	eachCard: (size, saved) => `khoảng ${size}${saved > 0 ? `, nhỏ hơn thiết kế ${saved}%` : ""}`,
	manifestNote: "Tệp zip có kèm _manifest.csv, cho biết tệp nào ứng với tên nào.",
	zipName: (base, n) => `${base}-${n}-thiep.zip`,

	shareFailed: "Chưa chia sẻ được. Hãy thử lại sau giây lát.",
	shareBody: "Ai có đường dẫn sẽ nhận được thiết kế, vị trí các ô chữ và phông chữ bạn đã thêm, rồi tự thêm danh sách tên của họ.",
	shareNote: "Danh sách tên của bạn không bao giờ được chia sẻ. Nó chỉ nằm trên thiết bị này.",
	shareLinkLabel: "Đường dẫn tới bố cục này",
	makingLink: "Đang tạo đường dẫn…",
	linkCopied: "Đã sao chép",
	copyLink: "Sao chép đường dẫn",
	sharedMissing: "Đường dẫn bố cục này không tồn tại hoặc đã hết hạn.",
	sharedCouldntLoad: "Không mở được bố cục này. Hãy thử lại sau giây lát.",
	sharedImageMissing: "Bố cục này bị thiếu thiết kế.",
	sharedFontMissing: (family) => `Bố cục này bị thiếu phông chữ “${family}”.`,

	cantOpenImage: "Trình duyệt này không mở được ảnh đó. Hãy dùng ảnh JPG, PNG hoặc WebP.",
	imageTooBig: "Ảnh lớn hơn 60 megapixel. Hãy thu nhỏ ảnh trước.",
	fontNoStyle: (family, weight, italic) => `Phông “${family}” không có kiểu ${italic ? "nghiêng " : ""}${weight}.`,
	fontUnreadable: (family) => `Không đọc được phông chữ “${family}”.`,
	notAFont: (file) => `“${file}” không phải tệp phông chữ mà trình duyệt này đọc được.`,

	home: {
		tryExample: "Dùng thử thiệp mẫu",
		title: (accent) => <>Một thiết kế. Thiệp cho {accent("từng")} người.</>,
		lead: "Thêm thiệp mời, giấy chứng nhận hay thẻ tên, dán danh sách, rồi tải về thiệp hoàn chỉnh cho từng người. Không cần gõ từng tên một.",
		addDesign: "Thêm thiết kế",
		dropTitle: "Thả thiết kế vào đây",
		dropHint: "Ảnh JPG, PNG hoặc WebP, chừa trống chỗ ghi tên.",
		choosePicture: "Chọn ảnh",
		ticks: ["Miễn phí", "Không cần đăng ký", "Danh sách không rời khỏi máy bạn"],
		stepsTitle: "Ba bước, khoảng một phút",
		step1: "Thêm thiết kế",
		step1Text: "Ảnh thiệp bất kỳ, chừa trống chỗ ghi tên. Chúng tôi đặt sẵn một tên lên đó để bạn kéo vào đúng chỗ.",
		nameGoesHere: "Tên ở đây",
		step2: "Thêm danh sách tên",
		step2Text: "Dán danh sách, hoặc thả tệp Excel hay CSV. Mỗi dòng một người; thêm cột như số bàn cũng được.",
		step3: "Tải về mọi thiệp",
		step3Text: "Chọn phông chữ và màu, rồi nhận mỗi người một ảnh trong một tệp zip, mỗi tệp đặt theo tên khách.",
		trustTitle: "Yên tâm giao danh sách khách mời",
		facts: [
			["Danh sách ở lại với bạn", "Thiệp được tạo ngay trong trình duyệt. Tên không bao giờ được tải lên đâu cả."],
			["Tên dài vẫn vừa", "Tên dài tự thu nhỏ cho vừa, và bạn được báo những tên cần xem lại trước khi tải về."],
			["Tiếng Việt hiển thị chuẩn", "Dấu được vẽ đúng, và phông chữ nào không có dấu đều được đánh dấu."],
			["Sẵn sàng gửi đi", "Thiệp được nén nhẹ mà không giảm chất lượng, gửi đi nhanh chóng."],
		],
		endTitle: "Chưa có thiết kế?",
		endText: "Bắt đầu từ một mẫu của chúng tôi rồi đổi sang thiết kế của bạn sau. Mỗi mẫu có sẵn vài cái tên để bạn thấy mọi thứ chạy ra sao.",
		kinds: { invitation: "Thiệp mời", certificate: "Giấy chứng nhận", badge: "Thẻ tên" },
		chooseExample: "Chọn mẫu để xem",
		pictureLabel: "Một thiết kế mẫu được điền lần lượt từng tên trong danh sách",
		tryIt: "Dùng thử",
	},
};

const STRINGS: Record<Lang, Strings> = { en, vi };
applyDocument(current);
