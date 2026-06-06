const stylesheet = document.getElementById("prism") as HTMLElement;
const toggleBtn = document.getElementById("toggle-btn") as HTMLElement;
const themeAssets = (window as any).__themeAssets;

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
