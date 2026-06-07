type ThemeAssetsWindow = Window &
	typeof globalThis & {
		__themeAssets: { prismCoy: string; prismTomorrow: string };
	};

const stylesheet = document.getElementById("prism") as HTMLElement;
const toggleBtn = document.getElementById("toggle-btn") as HTMLElement;
const themeAssets = (window as ThemeAssetsWindow).__themeAssets;
const prefetchedLinks = new Set<string>();

type NavigatorWithConnection = Navigator & {
	connection?: { saveData?: boolean };
};

function setTheme(isDark: boolean) {
	if (isDark) {
		localStorage.setItem("theme", "dark");
		document.body.classList.add("dark");
		toggleBtn.innerHTML = "☀️";
		toggleBtn.setAttribute("aria-label", "enable light theme");
		stylesheet.setAttribute("href", themeAssets.prismTomorrow);
	} else {
		localStorage.setItem("theme", "light");
		document.body.classList.remove("dark");
		toggleBtn.innerHTML = "🌙";
		toggleBtn.setAttribute("aria-label", "enable dark theme");
		stylesheet.setAttribute("href", themeAssets.prismCoy);
	}
}

function toggleTheme() {
	if (localStorage.getItem("theme") === "dark") {
		setTheme(false);
	} else {
		setTheme(true);
	}
}

if (!localStorage.getItem("theme")) {
	const osTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	localStorage.setItem("theme", osTheme);
}

toggleBtn.addEventListener("click", (e) => {
	e.preventDefault();
	toggleTheme();
});
setTheme(localStorage.getItem("theme") === "dark");

function maybePrefetchLink(link: HTMLAnchorElement) {
	if ((navigator as NavigatorWithConnection).connection?.saveData) {
		return;
	}

	const url = new URL(link.href);
	const currentUrl = new URL(location.href);
	url.hash = "";
	currentUrl.hash = "";
	if (
		url.origin !== location.origin ||
		url.href === currentUrl.href ||
		prefetchedLinks.has(url.href)
	) {
		return;
	}

	prefetchedLinks.add(url.href);
	const prefetch = document.createElement("link");
	prefetch.rel = "prefetch";
	prefetch.href = url.href;
	document.head.appendChild(prefetch);
}
for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
	link.addEventListener("mouseenter", () => maybePrefetchLink(link), { once: true });
}
