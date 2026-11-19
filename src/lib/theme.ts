export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "theme";
export const LIGHT_BG = "#F5F4F0";
export const DARK_BG = "#0D0E10";

/**
 * Runs before first paint (inline in <head>): applies this device's theme
 * override so a forced theme never flashes the system one first.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",t==="dark"?"${DARK_BG}":"${LIGHT_BG}")})}}catch(e){}`;
