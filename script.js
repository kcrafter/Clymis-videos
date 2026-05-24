const form = document.querySelector("#video-form");
const feed = document.querySelector("#video-feed");
const template = document.querySelector("#video-template");
const clearButton = document.querySelector("#clear-feed");

const formatDate = (isoDate) =>
  new Date(isoDate).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

function renderPost(post) {
  const clone = template.content.cloneNode(true);
  const video = clone.querySelector("video");

  video.src = post.videoUrl;
  video.type = post.mimeType || "video/mp4";
  clone.querySelector(".post-title").textContent = post.title;
  clone.querySelector(".post-description").textContent = post.description || "No description.";
  clone.querySelector(".post-meta").textContent = `Posted ${formatDate(post.createdAt)}`;

  feed.append(clone);
}

function showEmptyState() {
  feed.innerHTML = "<p>No videos yet — post the first one.</p>";
}

async function loadPosts() {
  const response = await fetch("/api/posts");
  if (!response.ok) {
    throw new Error("Could not load posts.");
  }

  const posts = await response.json();
  if (posts.length === 0) {
    showEmptyState();
    return;
  }

  feed.innerHTML = "";
  posts.reverse().forEach(renderPost);
}

form.addEventListener("submit", async (event) => {
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

  const body = new FormData();
  body.set("title", title);
  body.set("description", description);

  if (file) {
    body.set("videoFile", file);
  } else {
    body.set("videoUrl", url);
  }

  const response = await fetch("/api/posts", {
    method: "POST",
    body,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    alert(payload.error || "Could not save video.");
    return;
  }

  const post = await response.json();
  if (feed.textContent.includes("No videos yet")) {
    feed.innerHTML = "";
  }
  renderPost(post);
  form.reset();
});

clearButton.addEventListener("click", async () => {
  const response = await fetch("/api/posts", { method: "DELETE" });
  if (!response.ok) {
    alert("Could not clear feed.");
    return;
  }
  showEmptyState();
});

loadPosts().catch(() => {
  showEmptyState();
  alert("Could not connect to the server.");
});
