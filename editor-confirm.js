window.GameEditorConfirm = (() => {
  let active = false;
  function show({ title, description, confirmLabel, destructive = false }) {
    if (active) return Promise.resolve(false);
    active = true;
    const previousFocus = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "editor-confirm";
    dialog.setAttribute("aria-labelledby", "editorConfirmTitle");
    dialog.setAttribute("aria-describedby", "editorConfirmDescription");
    const heading = document.createElement("h2");
    heading.id = "editorConfirmTitle";
    heading.textContent = title;
    const text = document.createElement("p");
    text.id = "editorConfirmDescription";
    text.textContent = description;
    const actions = document.createElement("div");
    actions.className = "editor-confirm-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "キャンセル";
    cancel.autofocus = true;
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = destructive ? "confirm-danger" : "confirm-primary";
    confirm.textContent = confirmLabel;
    actions.append(cancel, confirm);
    dialog.append(heading, text, actions);
    document.body.append(dialog);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return new Promise(resolve => {
      let accepted = false;
      dialog.addEventListener("close", () => {
        dialog.remove();
        document.body.style.overflow = previousOverflow;
        active = false;
        if (previousFocus?.isConnected) previousFocus.focus();
        resolve(accepted);
      }, { once: true });
      cancel.addEventListener("click", () => dialog.close());
      confirm.addEventListener("click", () => { accepted = true; dialog.close(); });
      // showModal により背景操作を防ぎ、Esc でキャンセルできる。
      dialog.showModal();
      cancel.focus();
    });
  }
  return { show };
})();
