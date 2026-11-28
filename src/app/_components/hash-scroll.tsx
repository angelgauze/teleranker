"use client";

import { useEffect } from "react";

/**
 * Jumps to the section named in the address once content is on screen: pages
 * stream in after a loading placeholder, so the browser's own jump gives up.
 */
export function HashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return null;
}
