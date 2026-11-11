import { useSyncExternalStore, type ReactNode } from "react";

/**
 * The site's language: English or Vietnamese. A first visit follows the browser; after that the
 * person's choice is remembered on this device. The example invitation follows it too. A
 * person's own design and list are never touched.
 */
export type Lang = "en" | "vi";

const KEY = "wdf:lang";

/**
 * One language store for the whole page, kept on `globalThis` so that when the dev server reloads
 * this module, the new copy shares it instead of starting its own: otherwise screens opened after
 * the reload could read a different language from the ones already open.
 */
const store: { lang: Lang; listeners: Set<() => void> } = ((globalThis as { __wdfLang?: typeof store }).__wdfLang ??= {
	lang: initialLang(),
	listeners: new Set(),
});

function initialLang(): Lang {
	try {
		const saved = localStorage.getItem(KEY);
		if (saved === "en" || saved === "vi") return saved;
	} catch {
		// Storage can be blocked; fall back to the browser's language.
	}
	return fromBrowser();
}

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
	return store.lang;
}

export function setLang(lang: Lang) {
	store.lang = lang;
	try {
		localStorage.setItem(KEY, lang);
	} catch {
		// Storage can be blocked; the choice just lasts for this visit.
	}
	applyDocument(lang);
	store.listeners.forEach((l) => l());
}

function applyDocument(lang: Lang) {
	document.documentElement.lang = lang;
	document.title = STRINGS[lang].docTitle;
}

/** The current language's strings, for code outside React (error messages from the libraries). */
export function tr(): Strings {
	return STRINGS[store.lang];
}

/** The current language's strings; the component redraws when the language changes. */
export function useT(): Strings {
	return STRINGS[useLang()[0]];
}

const subscribe = (l: () => void) => {
	store.listeners.add(l);
	return () => void store.listeners.delete(l);
};

/** The language, read from the shared store on every render, so no screen can fall behind a change. */
export function useLang(): [Lang, (lang: Lang) => void] {
	return [useSyncExternalStore(subscribe, getLang), setLang];
}

const enNum = (n: number) => n.toLocaleString("en-US");
const viNum = (n: number) => n.toLocaleString("vi-VN");
const enList = (items: string[], word: "and" | "or") =>
	items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${word} ${items.at(-1)}`;
const viList = (items: string[], word: "and" | "or") =>
	items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} ${word === "and" ? "và" : "hay"} ${items.at(-1)}`;

const enWeights: Record<number, string> = {
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
};
const viWeights: Record<number, string> = {
	100: "Siêu mảnh",
	200: "Rất mảnh",
	300: "Mảnh",
	400: "Thường",
	500: "Vừa",
	600: "Hơi đậm",
	700: "Đậm",
	800: "Rất đậm",
	900: "Siêu đậm",
	1000: "Cực đậm",
};

const en = {
	docTitle: "Wot Da Fill · A card for every name",
	num: enNum,
	nOfM: (a: number, b: number) => `${enNum(a)} of ${enNum(b)}`,
	language: "Language",
	darkTheme: "Dark theme",
	github: "Source code on GitHub",
	feedback: "Send feedback or report a problem",
	feedbackSubject: "Wot Da Fill feedback",
	feedbackBody: "What happened, or what would you like to see?\n\n",
	feedbackBrowser: "My browser (helps find the problem):",
	switchTo: (name: string) => `Switch to ${name}`,
	lightTheme: "Light theme",
	langName: { en: "English", vi: "Tiếng Việt" },

	// Steps and the editor frame
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
	exampleOf: (name: string) => `Example: ${name}`,
	addYourNames: "Add your names",
	exampleTag: "example",
	openList: "Open the list",
	namesMissing: "no names yet",
	hideBoxes: "Hide the box outlines",
	showBoxes: "Show the box outlines",
	dismiss: "Close",
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
	couldntOpenPicture: "Couldn’t open that picture. Use a JPG, PNG or WebP.",
	drawingExample: "Getting the example ready…",
	couldntDrawExample: "Couldn’t open the example. Check your connection and try again.",
	boxRemoved: "Text box removed.",
	fontAdded: (family: string) => `Added your font “${family}”.`,
	couldntReadFont: "Couldn’t read that font. Use a TTF, OTF, WOFF or WOFF2 file.",
	fontLoadFailed: "Couldn’t load that font. Check your connection, or choose another font.",
	cleared: "Everything cleared.",
	listCleared: "List cleared.",
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
			<b>{n === 1 ? "1 name is" : `${enNum(n)} names are`} too long</b> for {many ? (n === 1 ? "its box" : "their boxes") : "the box"}.{" "}
			{spills && shrinks
				? "Some come out much smaller than the others, some spill over."
				: spills
					? `${n === 1 ? "It spills" : "They spill"} over the edge.`
					: `${n === 1 ? "It comes" : "They come"} out much smaller than the others.`}
		</>
	),
	allFit: (n: number, many: boolean) =>
		n === 1 ? `Your 1 name fits in ${many ? "the boxes" : "the box"}.` : `All ${enNum(n)} names fit in ${many ? "their boxes" : "the box"}.`,
	makeCards: (n: number) => (n ? `Make ${n === 1 ? "1 card" : `${enNum(n)} cards`}` : "Make the cards"),
	hintNoBox: "Drag on the design to add a text box.",
	hintTextFine: "Drag a box to move it. Arrow keys move it a little at a time; hold Shift to move it further.",
	hintTextCoarse: "Drag a box to move it. Drag on an empty spot to add another.",

	// Design step
	replaceDesign: "Replace the design",

	// Names step
	namesTitle: "Names",
	addNames: "Add your names",
	panelTabs: "Text and names",
	readingList: "Reading your list…",
	fileNoNames: "That file has no names in it. Check the file, or paste your list instead.",
	couldntReadFile: "Couldn’t read that file. Try saving it as Excel or CSV.",
	headings: "The first row is headings",
	clearList: "Clear the list",
	layoutUses: (cols: string[]): ReactNode => (
		<>
			This layout uses <b>{enList(cols, "and")}</b>. Add a list with those headings.
		</>
	),
	pasteLabel: "Type or paste your list, or drop a spreadsheet here",
	pasteHint: "Paste straight from Excel or Google Sheets. Tab moves to the next column, Enter to the next row.",
	columnName: (letter: string) => `Column ${letter}`,
	headingOf: (letter: string) => `Heading of column ${letter}`,
	cellOf: (row: number, letter: string) => `Row ${row}, column ${letter}`,
	typeOrPaste: "Type or paste here",
	addColumn: "Add a column",
	dropSpreadsheet: "Drop to use this spreadsheet",
	or: "Or",
	orElse: "or",
	chooseSpreadsheet: "choose a file",
	trySampleNames: "try example names",
	nameCount: (n: number) => (n === 1 ? "1 name" : `${enNum(n)} names`),
	from: "from",
	pastedList: "your list",
	sampleList: "the example list",
	rowNo: "No.",
	andMore: (n: number) => `and ${enNum(n)} more. Every one gets a card.`,
	noNamesYet: "There are no names under the headings yet.",
	sheet: "Sheet",

	// Text step
	textTitle: "Text",
	addInMiddle: "Add one in the middle",
	dragToAdd: "Drag to add a text box",
	textBoxes: "Text boxes",
	cardNumber: "Card number",
	pickBox: "Pick a text box on the design to change it.",
	whatItSays: "What it says",
	textPlaceholder: "Type something, or add from your list below",
	emptyBox: "Empty. Type its text under “What it says”.",
	maxSize: "Max size",
	unknownColumns: (cols: string[]) => `Your list has no ${enList(cols.map((c) => `“${c}”`), "or")}. Pick one of the buttons below or fix the spelling.`,
	addFromList: "Add from your list",
	font: "Font",
	size: "Size",
	colour: "Colour",
	fromDesign: "From your design",
	lineUp: "Line up",
	alignLeft: "Left",
	alignCentre: "Centre",
	alignRight: "Right",
	moreOptions: "More options",
	thickness: "Thickness",
	weights: enWeights,
	slant: "Slant",
	upright: "Upright",
	italic: "Italic",
	capitals: "Capital letters",
	asTyped: "As typed",
	eachWord: "Each Word",
	allCaps: "ALL CAPS",
	letterSpacing: "Letter spacing",
	lineHeight: "Line spacing",
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
	remove: "Remove",

	// Font picker
	searchFontsPlaceholder: "Search 1,700+ fonts",
	searchFonts: "Search fonts",
	fonts: "Fonts",
	fontsFound: (n: number, capped: boolean) => (capped ? `Showing the first ${enNum(n)}. Type more to narrow it down.` : `${enNum(n)} found`),
	curatedFonts: "Picked for invitations. All have Vietnamese accents.",
	loadingFonts: "Loading fonts…",
	noFontCalled: (q: string) => `No font called “${q}”. Check the spelling, or use your own font file.`,
	ownFont: "Use your own font file",
	yours: "Yours",

	// Making the cards
	wentWrong: "Something went wrong while making the cards. Go back and try again.",
	confirmStop: "Stop making the cards? The ones made so far will be thrown away.",
	cardsNotMade: "The cards weren’t made",
	cardsReady: (n: number) => `Your ${n === 1 ? "card is" : `${enNum(n)} cards are`} ready`,
	makingCards: "Making your cards",
	stop: "Stop",
	backToEditing: "Back to editing",
	almostDone: "almost done",
	secondsLeft: (s: number) => `about ${s} seconds left`,
	minuteLeft: "about 1 minute left",
	minutesLeft: (m: number) => `about ${m} minutes left`,
	gettingFonts: "Getting the fonts ready",
	zipping: "Putting them in one zip",
	privacyRun: "Everything happens in your browser. Your list never leaves this device.",
	zipNote: (size: string) => `Every card in one zip file · ${size}`,
	downloadAll: "Download all",
	viewCard: (name: string) => `View ${name}`,
	downloadCard: "Download",
	prevCard: "Previous card",
	nextCard: "Next card",
	cardsFailed: (n: number, rows: string): ReactNode => (
		<>
			<b>{n === 1 ? "1 card" : `${enNum(n)} cards`} couldn’t be made</b> ({n === 1 ? "number" : "numbers"} {rows}). The zip has all the
			others. To get {n === 1 ? "it" : "them"}, go back and make the cards again.
		</>
	),
	saveCard: (name: string) => `Download ${name}`,
	showMore: (n: number) => `Show more (${enNum(n)} left)`,
	details: "Details",
	statSize: "Size",
	statZip: "Zip file",
	statEach: "Each card",
	statTook: "Time taken",
	eachCard: (size: string, saved: number) => `about ${size}${saved > 0 ? `, ${saved}% smaller than your design` : ""}`,
	manifestNote: "The zip also has _list.csv, which shows which card belongs to which name.",
	manifestFile: "_list.csv",
	manifestCard: "Card",
	zipName: (base: string, n: number) => `${base}-${n}-${n === 1 ? "card" : "cards"}.zip`,
	cardsBase: "cards",
	yourFont: "Your font",
	seconds: (s: number) => (s < 1 ? "less than a second" : s === 1 ? "1 second" : `${s} seconds`),
	minSec: (m: number, s: number) => `${m} min ${s} s`,

	// Sharing
	shareFailed: "Sharing didn’t work. Try again in a moment.",
	shareErrors: {
		rate: "Too many links made from your network. Try again in a minute.",
		"too-large": "That design is over 25 MB, which is too big to share. Use a smaller picture.",
		"bad-image": "Only JPG, PNG or WebP designs can be shared.",
		"too-many-boxes": "A layout can be shared with up to 50 text boxes.",
		"too-many-fonts": "A layout can be shared with up to 8 of your own fonts.",
		"bad-font": "One of your fonts is over 8 MB or can’t be read, so it can’t be shared. Choose another font.",
	} as Record<string, string>,
	shareBody: "Anyone with the link gets your design, where the text goes and any fonts you added, then adds their own names.",
	shareNote: "Your list of names is never shared. It stays on this device.",
	shareLinkLabel: "Link to this layout",
	makingLink: "Making the link…",
	linkCopied: "Link copied",
	copyLink: "Copy link",
	sharedMissing: "This layout link doesn’t exist, or it has expired. Ask for a new link.",
	sharedCouldntLoad: "Couldn’t open this layout. Try again in a moment.",
	sharedImageMissing: "This layout’s design is missing. Ask for a new link.",
	sharedFontMissing: (family: string) => `The font “${family}” is missing from this layout. Ask for a new link.`,

	// Errors from opening pictures and fonts
	cantOpenImage: "This browser can’t open that picture. Use a JPG, PNG or WebP.",
	imageTooBig: "That picture is too big (over 60 megapixels). Save a smaller copy and add that.",
	fontNoStyle: (family: string, weight: number, italic: boolean) =>
		`“${family}” has no ${(enWeights[weight] ?? String(weight)).toLowerCase()}${italic ? " italic" : ""} style. Choose another thickness under More options.`,
	fontUnreadable: (family: string) => `Couldn’t load the font “${family}”. Choose another font.`,
	notAFont: (file: string) => `“${file}” isn’t a font this browser can read. Use a TTF, OTF, WOFF or WOFF2 file.`,

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
		stepsTitle: "3 steps, about a minute",
		step1: "Add your design",
		step1Text: "Any picture of your card with the name left blank. We put a name on it straight away so you can drag it into place.",
		nameGoesHere: "Name goes here",
		step2: "Add your names",
		step2Text: "Paste them, or drop an Excel or CSV file. One person per line; extra columns like table numbers work too.",
		step3: "Download every card",
		step3Text: "Pick a font and colour, then download one card per person in a single zip. Each card is named after the person it is for.",
		trustTitle: "Made to be trusted with a guest list",
		facts: [
			["Your list stays with you", "The cards are made in your browser. Names are never uploaded anywhere."],
			["Long names fit", "Long names shrink to fit, and you are told which ones need a look before you download."],
			["Ready to send", "Cards are kept small and still look sharp, so they are quick to share."],
		] as [string, string][],
		endTitle: "No design yet?",
		endText: "Start from one of ours and swap in your own later. Each comes with a few names so you can see the whole thing work.",
		kinds: { invitation: "Invitation", certificate: "Certificate", badge: "Name badge" } as Record<"invitation" | "certificate" | "badge", string>,
		chooseExample: "Which example to show",
		pictureLabel: "An example design filled in with each name from a list, one after another",
		tryIt: "Try it",
	},
};

export type Strings = typeof en;

const vi: Strings = {
	docTitle: "Wot Da Fill · Thiệp riêng cho từng người",
	num: viNum,
	nOfM: (a, b) => `${viNum(a)} / ${viNum(b)}`,
	language: "Ngôn ngữ",
	darkTheme: "Giao diện tối",
	github: "Mã nguồn trên GitHub",
	feedback: "Góp ý hoặc báo lỗi",
	feedbackSubject: "Góp ý Wot Da Fill",
	feedbackBody: "Bạn gặp vấn đề gì, hoặc muốn có thêm tính năng gì?\n\n",
	feedbackBrowser: "Trình duyệt của tôi (giúp tìm ra lỗi):",
	switchTo: (name) => `Chuyển sang ${name}`,
	lightTheme: "Giao diện sáng",
	langName: en.langName,

	share: "Chia sẻ",
	shareLayout: "Chia sẻ bố cục này",
	more: "Xem thêm",
	startOver: "Làm lại từ đầu",
	undo: "Hoàn tác",
	redo: "Làm lại",
	prevName: "Tên trước",
	nextName: "Tên sau",
	whichName: "Chọn tên để xem",
	empty: "trống",
	exampleOf: (name) => `Tên mẫu: ${name}`,
	addYourNames: "Thêm danh sách tên",
	exampleTag: "tên mẫu",
	openList: "Mở danh sách",
	namesMissing: "chưa có danh sách",
	hideBoxes: "Ẩn khung ô chữ",
	showBoxes: "Hiện khung ô chữ",
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
	couldntOpenPicture: "Không mở được ảnh này. Hãy dùng ảnh JPG, PNG hoặc WebP.",
	drawingExample: "Đang chuẩn bị thiết kế mẫu…",
	couldntDrawExample: "Không mở được thiết kế mẫu. Hãy kiểm tra kết nối mạng rồi thử lại.",
	boxRemoved: "Đã xoá ô chữ.",
	fontAdded: (family) => `Đã thêm phông chữ “${family}”.`,
	couldntReadFont: "Không đọc được phông chữ này. Hãy dùng tệp TTF, OTF, WOFF hoặc WOFF2.",
	fontLoadFailed: "Không tải được phông chữ này. Hãy kiểm tra kết nối mạng hoặc chọn phông chữ khác.",
	cleared: "Đã xoá hết.",
	listCleared: "Đã xoá danh sách.",
	missingDesign: "Hãy thêm thiết kế trước.",
	missingNames: "Hãy thêm danh sách tên trước.",
	missingBox: "Hãy thêm một ô chữ trước.",
	showMe: "Xem",
	missingColumns: (cols) => (
		<>
			Danh sách của bạn không có cột <b>{viList(cols, "or")}</b>, nên phần đó sẽ bị trống trên mọi thiệp.
		</>
	),
	tooLong: (n, _many, spills, shrinks) => (
		<>
			<b>{viNum(n)} tên quá dài</b> so với ô chữ.{" "}
			{spills && shrinks
				? "Có tên bị nhỏ hơn hẳn các tên khác, có tên tràn ra ngoài ô."
				: spills
					? "Tên quá dài sẽ tràn ra ngoài ô."
					: "Tên quá dài sẽ nhỏ hơn hẳn các tên khác."}
		</>
	),
	allFit: (n, many) =>
		n === 1 ? `Tên trong danh sách vừa ${many ? "các ô chữ" : "ô chữ"}.` : `Cả ${viNum(n)} tên đều vừa ${many ? "các ô chữ" : "ô chữ"}.`,
	makeCards: (n) => (n ? `Tạo ${viNum(n)} thiệp` : "Tạo thiệp"),
	hintNoBox: "Kéo trên thiết kế để thêm ô chữ.",
	hintTextFine: "Kéo ô chữ để di chuyển. Phím mũi tên dịch từng chút một; giữ Shift để dịch xa hơn.",
	hintTextCoarse: "Kéo ô chữ để di chuyển. Kéo ở chỗ trống để thêm ô khác.",

	replaceDesign: "Thay thiết kế",

	namesTitle: "Danh sách",
	addNames: "Thêm danh sách tên",
	panelTabs: "Chữ và danh sách",
	readingList: "Đang đọc danh sách…",
	fileNoNames: "Tệp này không có tên nào. Hãy kiểm tra lại tệp, hoặc dán danh sách vào.",
	couldntReadFile: "Không đọc được tệp này. Hãy thử lưu lại dưới dạng Excel hoặc CSV.",
	headings: "Dòng đầu là tiêu đề cột",
	clearList: "Xoá danh sách",
	layoutUses: (cols) => (
		<>
			Bố cục này dùng cột <b>{viList(cols, "and")}</b>. Hãy thêm danh sách có các cột này.
		</>
	),
	pasteLabel: "Nhập hoặc dán danh sách, hoặc thả tệp bảng tính vào đây",
	pasteHint: "Có thể dán thẳng từ Excel hoặc Google Sheets. Tab để sang cột tiếp theo, Enter để xuống dòng.",
	// A column with no heading is called "Cột A"; text that says {Column A} still finds it (see fold in text.ts).
	columnName: (letter) => `Cột ${letter}`,
	headingOf: (letter) => `Tiêu đề cột ${letter}`,
	cellOf: (row, letter) => `Dòng ${row}, cột ${letter}`,
	typeOrPaste: "Nhập hoặc dán vào đây",
	addColumn: "Thêm cột",
	dropSpreadsheet: "Thả để dùng bảng tính này",
	or: "Hoặc",
	orElse: "hoặc",
	chooseSpreadsheet: "chọn tệp",
	trySampleNames: "dùng thử danh sách mẫu",
	nameCount: (n) => `${viNum(n)} tên`,
	from: "từ",
	pastedList: "danh sách của bạn",
	sampleList: "danh sách mẫu",
	rowNo: "STT",
	andMore: (n) => `và ${viNum(n)} tên nữa. Ai cũng sẽ có thiệp.`,
	noNamesYet: "Chưa có tên nào dưới dòng tiêu đề.",
	sheet: "Trang tính",

	textTitle: "Chữ",
	addInMiddle: "Thêm một ô ở giữa",
	dragToAdd: "Kéo để thêm ô chữ",
	textBoxes: "Các ô chữ",
	cardNumber: "Số thứ tự",
	pickBox: "Chọn một ô chữ trên thiết kế để chỉnh.",
	whatItSays: "Nội dung",
	textPlaceholder: "Nhập chữ, hoặc thêm từ danh sách bên dưới",
	emptyBox: "Trống. Nhập chữ ở mục “Nội dung”.",
	maxSize: "Cỡ tối đa",
	unknownColumns: (cols) => `Danh sách của bạn không có cột ${viList(cols.map((c) => `“${c}”`), "or")}. Hãy chọn một nút bên dưới hoặc sửa lại chính tả.`,
	addFromList: "Thêm từ danh sách",
	font: "Phông chữ",
	size: "Cỡ chữ",
	colour: "Màu",
	fromDesign: "Màu từ thiết kế",
	lineUp: "Căn lề",
	alignLeft: "Trái",
	alignCentre: "Giữa",
	alignRight: "Phải",
	moreOptions: "Tuỳ chọn khác",
	thickness: "Độ đậm",
	weights: viWeights,
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
	centreOnDesign: "Căn giữa trên thiết kế",
	remove: "Xoá",

	searchFontsPlaceholder: "Tìm trong hơn 1.700 phông chữ",
	searchFonts: "Tìm phông chữ",
	fonts: "Phông chữ",
	fontsFound: (n, capped) => (capped ? `Đang hiện ${viNum(n)} kết quả đầu. Gõ thêm để thu hẹp.` : `Tìm thấy ${viNum(n)}`),
	curatedFonts: "Chọn sẵn cho thiệp mời. Tất cả đều có dấu tiếng Việt.",
	loadingFonts: "Đang tải phông chữ…",
	noFontCalled: (q) => `Không có phông chữ nào tên “${q}”. Hãy kiểm tra chính tả, hoặc dùng tệp phông chữ của bạn.`,
	ownFont: "Dùng tệp phông chữ của bạn",
	yours: "Của bạn",

	wentWrong: "Đã có lỗi khi tạo thiệp. Hãy quay lại và thử lại.",
	confirmStop: "Dừng tạo thiệp? Những thiệp đã tạo sẽ bị bỏ đi.",
	cardsNotMade: "Chưa tạo được thiệp",
	cardsReady: (n) => `${viNum(n)} thiệp của bạn đã sẵn sàng`,
	makingCards: "Đang tạo thiệp",
	stop: "Dừng",
	backToEditing: "Quay lại chỉnh sửa",
	almostDone: "sắp xong",
	secondsLeft: (s) => `còn khoảng ${s} giây`,
	minuteLeft: "còn khoảng 1 phút",
	minutesLeft: (m) => `còn khoảng ${m} phút`,
	gettingFonts: "Đang chuẩn bị phông chữ",
	zipping: "Đang gói vào một tệp zip",
	privacyRun: "Mọi thứ diễn ra ngay trong trình duyệt của bạn. Danh sách của bạn không rời khỏi thiết bị này.",
	zipNote: (size) => `Tất cả thiệp trong một tệp zip · ${size}`,
	downloadAll: "Tải về tất cả",
	viewCard: (name) => `Xem ${name}`,
	downloadCard: "Tải về",
	prevCard: "Thiệp trước",
	nextCard: "Thiệp sau",
	cardsFailed: (n, rows) => (
		<>
			<b>{viNum(n)} thiệp không tạo được</b> (số {rows}). Tệp zip có đủ các thiệp còn lại. Hãy quay lại và tạo thiệp lần nữa để có đủ.
		</>
	),
	saveCard: (name) => `Tải về ${name}`,
	showMore: (n) => `Xem thêm (còn ${viNum(n)})`,
	details: "Chi tiết",
	statSize: "Kích thước",
	statZip: "Tệp zip",
	statEach: "Mỗi thiệp",
	statTook: "Thời gian",
	eachCard: (size, saved) => `khoảng ${size}${saved > 0 ? `, nhỏ hơn thiết kế ${saved}%` : ""}`,
	manifestNote: "Tệp zip có kèm _danh-sach.csv, cho biết thiệp nào ứng với tên nào.",
	manifestFile: "_danh-sach.csv",
	manifestCard: "Thiệp",
	zipName: (base, n) => `${base}-${n}-thiep.zip`,
	cardsBase: "thiep",
	yourFont: "Phông chữ của bạn",
	seconds: (s) => (s < 1 ? "chưa đến 1 giây" : `${s} giây`),
	minSec: (m, s) => `${m} phút ${s} giây`,

	shareFailed: "Chưa chia sẻ được. Hãy thử lại sau giây lát.",
	shareErrors: {
		rate: "Mạng của bạn vừa tạo quá nhiều đường dẫn. Hãy thử lại sau 1 phút.",
		"too-large": "Thiết kế này lớn hơn 25 MB nên không chia sẻ được. Hãy dùng ảnh nhỏ hơn.",
		"bad-image": "Chỉ chia sẻ được thiết kế là ảnh JPG, PNG hoặc WebP.",
		"too-many-boxes": "Bố cục chỉ chia sẻ được với tối đa 50 ô chữ.",
		"too-many-fonts": "Bố cục chỉ chia sẻ được kèm tối đa 8 phông chữ của bạn.",
		"bad-font": "Một phông chữ của bạn lớn hơn 8 MB hoặc không đọc được nên không chia sẻ được. Hãy chọn phông chữ khác.",
	},
	shareBody: "Ai có đường dẫn sẽ nhận được thiết kế, vị trí các ô chữ và phông chữ bạn đã thêm, rồi tự thêm danh sách tên của họ.",
	shareNote: "Danh sách tên của bạn không bao giờ được chia sẻ. Danh sách chỉ nằm trên thiết bị này.",
	shareLinkLabel: "Đường dẫn tới bố cục này",
	makingLink: "Đang tạo đường dẫn…",
	linkCopied: "Đã sao chép",
	copyLink: "Sao chép đường dẫn",
	sharedMissing: "Đường dẫn bố cục này không tồn tại hoặc đã hết hạn. Hãy xin một đường dẫn mới.",
	sharedCouldntLoad: "Không mở được bố cục này. Hãy thử lại sau giây lát.",
	sharedImageMissing: "Bố cục này bị thiếu thiết kế. Hãy xin một đường dẫn mới.",
	sharedFontMissing: (family) => `Bố cục này bị thiếu phông chữ “${family}”. Hãy xin một đường dẫn mới.`,

	cantOpenImage: "Trình duyệt không mở được ảnh này. Hãy dùng ảnh JPG, PNG hoặc WebP.",
	imageTooBig: "Ảnh này quá lớn (hơn 60 megapixel). Hãy lưu một bản nhỏ hơn rồi thêm lại.",
	fontNoStyle: (family, weight, italic) =>
		`Phông chữ “${family}” không có kiểu ${(viWeights[weight] ?? String(weight)).toLowerCase()}${italic ? " nghiêng" : ""}. Hãy chọn độ đậm khác trong Tuỳ chọn khác.`,
	fontUnreadable: (family) => `Không tải được phông chữ “${family}”. Hãy chọn phông chữ khác.`,
	notAFont: (file) => `Trình duyệt không đọc được phông chữ “${file}”. Hãy dùng tệp TTF, OTF, WOFF hoặc WOFF2.`,

	home: {
		tryExample: "Dùng thử thiệp mẫu",
		title: (accent) => <>Một thiết kế. Thiệp cho {accent("từng")} người.</>,
		lead: "Thêm thiệp mời, giấy chứng nhận hay thẻ tên, dán danh sách, rồi tải về thiệp hoàn chỉnh cho từng người. Không cần gõ từng tên một.",
		addDesign: "Thêm thiết kế",
		dropTitle: "Thả thiết kế vào đây",
		dropHint: "Ảnh JPG, PNG hoặc WebP, chừa trống chỗ ghi tên.",
		choosePicture: "Chọn ảnh",
		ticks: ["Miễn phí", "Không cần đăng ký", "Danh sách không rời khỏi thiết bị này"],
		stepsTitle: "3 bước, khoảng 1 phút",
		step1: "Thêm thiết kế",
		step1Text: "Ảnh thiệp bất kỳ, chừa trống chỗ ghi tên. Chúng tôi đặt sẵn một tên lên đó để bạn kéo vào đúng chỗ.",
		nameGoesHere: "Chỗ ghi tên",
		step2: "Thêm danh sách tên",
		step2Text: "Dán danh sách, hoặc thả tệp Excel hay CSV. Mỗi dòng một người; có thêm cột như số bàn cũng được.",
		step3: "Tải về tất cả thiệp",
		step3Text: "Chọn phông chữ và màu, rồi tải về một tệp zip, mỗi người một thiệp. Mỗi thiệp được đặt tên theo tên người nhận.",
		trustTitle: "Yên tâm giao danh sách khách mời",
		facts: [
			["Danh sách chỉ ở trên thiết bị của bạn", "Thiệp được tạo ngay trong trình duyệt. Tên không bao giờ được tải lên bất cứ đâu."],
			["Tên dài vẫn vừa", "Tên dài tự thu nhỏ cho vừa. Tên nào cần xem lại, bạn sẽ được báo trước khi tải về."],
			["Sẵn sàng gửi đi", "Thiệp nhẹ mà vẫn sắc nét, nên gửi đi rất nhanh."],
		],
		endTitle: "Chưa có thiết kế?",
		endText: "Bắt đầu từ một thiết kế mẫu, rồi đổi sang thiết kế của bạn sau. Mỗi mẫu có sẵn vài tên để bạn xem thử từ đầu đến cuối.",
		kinds: { invitation: "Thiệp mời", certificate: "Giấy chứng nhận", badge: "Thẻ tên" },
		chooseExample: "Chọn mẫu để xem",
		pictureLabel: "Một thiết kế mẫu được điền lần lượt từng tên trong danh sách",
		tryIt: "Dùng thử",
	},
};

const STRINGS: Record<Lang, Strings> = { en, vi };
applyDocument(store.lang);
