const form = document.querySelector("#video-form");
const feed = document.querySelector("#video-feed");
const template = document.querySelector("#video-template");
const clearButton = document.querySelector("#clear-feed");

const STORAGE_KEY = "clymis-video-posts";

const posts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

const formatDate = (isoDate) =>
  new Date(isoDate).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

function savePosts() {
  const serializable = posts.filter((post) => post.sourceType !== "file");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

function renderPost(post) {
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector(".video-post");
  const video = clone.querySelector("video");

  video.src = post.videoUrl;
  video.type = post.mimeType || "video/mp4";
  clone.querySelector(".post-title").textContent = post.title;
  clone.querySelector(".post-description").textContent = post.description || "No description.";
  clone.querySelector(".post-meta").textContent = `Posted ${formatDate(post.createdAt)}`;

  if (post.sourceType === "file") {
    card.dataset.temporary = "true";
  }

  feed.prepend(clone);
}

function restoreFeed() {
  if (posts.length === 0) {
    feed.innerHTML = "<p>No videos yet — post the first one.</p>";
    return;
  }

  feed.innerHTML = "";
  posts.forEach(renderPost);
}

function makePost({ title, description, videoUrl, mimeType, sourceType }) {
  return {
    title,
    description,
    videoUrl,
    mimeType,
    sourceType,
    createdAt: new Date().toISOString(),
  };
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = form.title.value.trim();
  const description = form.description.value.trim();
  const url = form["video-url"].value.trim();
  const file = form["video-file"].files[0];

  if (!title) {
    alert("Please add a title.");
    return;
  }

  if (!url && !file) {
    alert("Provide a video URL or upload a file.");
    return;
  }

  if (feed.textContent.includes("No videos yet")) {
    feed.innerHTML = "";
  }

  if (file) {
    const objectUrl = URL.createObjectURL(file);
    const post = makePost({
      title,
      description,
      videoUrl: objectUrl,
      mimeType: file.type,
      sourceType: "file",
    });

    posts.push(post);
    renderPost(post);
    form.reset();
    return;
  }

  const post = makePost({
    title,
    description,
    videoUrl: url,
    mimeType: "video/mp4",
    sourceType: "url",
  });

  posts.push(post);
  renderPost(post);
  savePosts();
  form.reset();
});

clearButton.addEventListener("click", () => {
  posts.length = 0;
  localStorage.removeItem(STORAGE_KEY);
  feed.innerHTML = "<p>No videos yet — post the first one.</p>";
});

restoreFeed();
