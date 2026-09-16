const context = document.createElement("canvas").getContext("2d");

// Measure whole words in the actual heading font. Multiword names still wrap at
// spaces, but a long word gets a small size adjustment instead of a stray letter.
export function fitFlavorNames(root) {
  if (!context) return;
  for (const title of root.querySelectorAll(".card-name")) {
    if (!title.childElementCount) {
      const words = title.textContent.trim().split(/\s+/);
      title.replaceChildren(...words.flatMap((word, index) => {
        const span = document.createElement("span");
        span.textContent = word;
        return index ? [document.createTextNode(" "), span] : [span];
      }));
    }
    const header = title.closest(".card-top");
    header.classList.remove("wide-name");
    title.style.removeProperty("font-size");
    const style = getComputedStyle(title);
    const base = parseFloat(style.fontSize);
    const minimum = parseFloat(style.getPropertyValue("--flavor-name-min")) || 11;
    const spacing = parseFloat(style.letterSpacing) || 0;
    context.font = `${style.fontWeight} ${base}px ${style.fontFamily}`;
    const words = title.textContent.toLocaleUpperCase("en-US").split(/\s+/).filter(Boolean);
    const longest = Math.max(1, ...words.map(word => context.measureText(word).width + word.length * spacing));
    const sizeForWidth = () => Math.min(base, Math.floor(base * (title.clientWidth - 1) / longest * 10) / 10);
    let size = sizeForWidth();
    // On the narrowest phones, use the space below the scoop before making type
    // too small to read. The freezer's responsive grid stays intact.
    if (size < minimum) {
      header.classList.add("wide-name");
      size = sizeForWidth();
    }
    title.style.fontSize = `${Math.max(minimum, size)}px`;
  }
}

export function setupFlavorNameFitting(root) {
  let dimensions = "";
  const observer = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect;
    const next = `${width}:${height}`;
    if (next === dimensions) return;
    dimensions = next;
    fitFlavorNames(root);
  });
  observer.observe(root);
  document.fonts.ready.then(() => fitFlavorNames(root));
  document.fonts.addEventListener("loadingdone", () => fitFlavorNames(root));
}
