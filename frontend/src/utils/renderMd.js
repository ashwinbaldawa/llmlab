export function renderMd(t) {
  if (!t) return "";
  let h = "",
    il = false,
    ic = false,
    cd = "";

  for (const l of t.split("\n")) {
    if (l.startsWith("```")) {
      if (ic) {
        h += '<pre class="md-code">' + cd + "</pre>";
        cd = "";
        ic = false;
      } else {
        ic = true;
      }
      continue;
    }
    if (ic) {
      cd += l + "\n";
      continue;
    }
    if (/^#{1,4}\s/.test(l)) {
      if (il) { h += "</ul>"; il = false; }
      h += '<p style="font-weight:700;margin:14px 0 6px;color:#d0d0dc">' + l.replace(/^#+\s/, "") + "</p>";
    } else if (/^[-*]\s/.test(l)) {
      if (!il) { h += '<ul style="margin:4px 0;padding-left:20px">'; il = true; }
      h += "<li style='margin:2px 0;line-height:1.65'>" + l.slice(2) + "</li>";
    } else if (!l.trim()) {
      if (il) { h += "</ul>"; il = false; }
      h += "<br/>";
    } else {
      if (il) { h += "</ul>"; il = false; }
      h +=
        '<p style="margin:3px 0;line-height:1.7">' +
        l
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/`(.+?)`/g, '<code class="md-ic">$1</code>') +
        "</p>";
    }
  }
  if (il) h += "</ul>";
  return h;
}
