/* I LOVE GAME♪ 共通ニュース一覧 */
(function () {
  "use strict";

  function navigate(page) {
    const url = new URL(window.location.href);
    url.searchParams.set("page", page);
    url.hash = "latest";
    window.location.href = url.toString();
  }

  window.GameNewsList = {
    navigate
  };
})();
