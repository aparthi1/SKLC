

try {
  if (typeof Swiper !== "undefined") {
    new Swiper(".mySwiper", {
      pagination: { el: ".swiper-pagination" },
      autoplay: { delay: 2500, disableOnInteraction: false },
      loop: true,
    });
  }
} catch (e) { console.warn("Swiper init failed", e); }
