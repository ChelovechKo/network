let currentEditablePost = null;
let currentPage = 1;

// Auto Change Height in form-control
function adjustHeight(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

// Handle - Follow / Unfollow
function toggleFollow(username) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    fetch(`/toggle_follow/${username}`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error(data.error);
        } else {
            const followBtn = document.getElementById('follow-btn');
            followBtn.textContent = data.is_following ? 'Unfollow' : 'Follow';
            followBtn.className = `btn btn-${data.is_following ? 'danger' : 'primary'} mb-3`;
            document.getElementById('followers_cnt').textContent = data.followers_count;
        }
    })
    .catch(error => console.error('Error:', error));
}

// Handle Like / Unlike
function likeHandle(e){
    const button = e.target;
    const postId = e.target.dataset.postId;
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    console.log("postId:", postId);

    fetch(`/toggle_like/${postId}`, {
        method: 'POST',
        headers: {
            'X-CSRFToken': csrfToken,
            'Content-Type': 'application/json',
        },
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error(data.error);
            } else {
                // Update button icon
                 if (data.liked) {
                    e.target.classList.remove('bi-heart');
                    e.target.classList.add('bi-heart-fill');
                } else {
                    e.target.classList.remove('bi-heart-fill');
                    e.target.classList.add('bi-heart');
                }

                // Update like count
                const likeCountSpan = button.nextElementSibling;
                likeCountSpan.textContent = `${data.likes_count}`;
            }
        })
        .catch(error => console.error('Error:', error));
}

// User Profile
function loadUserProfile(username){
    const userProfile = document.getElementById("user-profile");
    fetch(`/${username}?page=1`, { headers: { "x-requested-with": "XMLHttpRequest" } })
        .then(response => response.json())
        .then(data => {
            if (data.profile) {
                userProfile.innerHTML = `
                    <hr>
                    ${currentUser && currentUser !== "null" && currentUser !== data.profile.profile_user ? `
                        
                        <button id="follow-btn" class="btn btn-${data.profile.is_following ? 'danger' : 'primary'} mb-3">
                            ${data.profile.is_following ? 'Unfollow' : 'Follow'}
                        </button>
                    ` : ''}
                    <p>
                        <strong>Following:</strong> <span id="following_cnt">${data.profile.following_count}</span> |
                        <strong>Followers:</strong> <span id="followers_cnt">${data.profile.followers_count}</span>
                    </p>
                    <hr>
                `;

                // Add follow/unfollow button handler
                const followBtn = document.getElementById("follow-btn");
                if (followBtn) {
                    followBtn.addEventListener('click', function() {
                        toggleFollow(username);
                    });
                }
            }

            userProfile.style.display = 'block';
            // Load posts after profile info is updated
            loadPosts(1, username);
        });
}

// Handle - Create New Post
function handleNewPost(event) {
    event.preventDefault();

    const description = document.getElementById("description-form");
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    fetch("/new_post", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-CSRFToken": csrfToken
        },
        body: `description=${encodeURIComponent(description.value)}`
    })
    .then(response => response.json())
    .then(post => {
        const postElement = renderPost(post, true);
        const postsList = document.getElementById("posts-list");

        // Add the new post at the top
        postsList.prepend(postElement);

        // Check if posts exceed 10 and handle pagination
        if (postsList.childElementCount > 10) {
            // Move the last post to the next page
            const lastPost = postsList.lastElementChild;
            postsList.removeChild(lastPost);

            // Update pagination state
            loadPosts(currentPage);
        }

        // Reset the new post form
        postElement.style.animationPlayState = 'running';
        postElement.addEventListener('animationend', () => {
            postElement.classList.remove('new-post');
        });

        description.value = "";
        description.style.height = "";
    })
    .catch(error => console.error("Error:", error));
}

// Delete Post
function deletePost(postElement, postId) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    fetch(`/delete_post/${postId}`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': csrfToken,
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        postElement.classList.add('animate-hide');
        postElement.addEventListener('animationend', () => {
            postElement.remove();
        });
    })
    .catch(error => console.error('Error deleting post:', error));
}

// Cancel Edit
function cancelEdit(postElement, rawMarkdown, oldDescription) {
    // Restore old content
    const textarea = postElement.querySelector('textarea');
    const newDescriptionContainer = document.createElement('span');
    newDescriptionContainer.className = 'post-description';
    newDescriptionContainer.setAttribute('data-raw-markdown', rawMarkdown);
    newDescriptionContainer.innerHTML = oldDescription;
    textarea.replaceWith(newDescriptionContainer);

    // Hide Save и Cancel buttons
    const saveCancelButton = postElement.querySelector('.saveCancelButton');
    saveCancelButton.style.display = 'none';

    // Show editDeleteButton
    const editDeleteButton = postElement.querySelector('.editDeleteButton');
    editDeleteButton.style.display = 'block';
}

// Save Edit
function saveEdit(postElement, postId, newDescription) {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    fetch(`/edit_post/${postId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({ description: newDescription}),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Update Description
        const contentElement = document.createElement('span');
        contentElement.className = 'post-description';
        contentElement.setAttribute('data-raw-markdown', data.raw_description);
        contentElement.innerHTML = data.description;
        postElement.querySelector('textarea').replaceWith(contentElement);

        // Hide Save и Cancel buttons
        const saveCancelButton = postElement.querySelector('.saveCancelButton');
        saveCancelButton.style.display = 'none';

        // Show editDeleteButton
        const editDeleteButton = postElement.querySelector('.editDeleteButton');
        editDeleteButton.style.display = 'block';
    })
    .catch(error => console.error('Error updating post:', error));
}

// Enable Edit
function enableEdit(postElement, postId) {
    // Check. In one moment we can edit one post
    if (currentEditablePost && currentEditablePost !== postElement) {
        const oldDescription = currentEditablePost.querySelector('textarea').value;
        cancelEdit(currentEditablePost, oldDescription);
    }
    currentEditablePost = postElement;

    // Save old Description
    const descriptionElement = postElement.querySelector('.post-description');
    const rawMarkdown = descriptionElement.getAttribute('data-raw-markdown');
    const oldDescription = descriptionElement.innerHTML;

    // Replace on Textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'form-control';
    textarea.value = rawMarkdown || oldDescription;
    descriptionElement.replaceWith(textarea);

    // Automatically adjust height of textarea
    adjustHeight(textarea);

    textarea.addEventListener('input', function () {
        adjustHeight(textarea);
    });

    // add function to button
    const saveCancelButton = postElement.querySelector('.saveCancelButton');
    saveCancelButton.style.display = 'block';
    const saveButton = saveCancelButton.querySelector('.btn-primary');
    const cancelButton = saveCancelButton.querySelector('.btn-secondary');
    saveButton.onclick = function () {
        saveEdit(postElement, postId, textarea.value);
        currentEditablePost = null;
    };

    cancelButton.onclick = function () {
        cancelEdit(postElement, rawMarkdown, oldDescription);
        currentEditablePost = null;
    };

    // Hide editDeleteButton
    const editDeleteButton = postElement.querySelector('.editDeleteButton');
    editDeleteButton.style.display = 'none';
}

// Pagination buttons handler
function addPaginationListeners() {
    const paginationLinks = document.querySelectorAll('.page-link');
    paginationLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault(); // switch-off standard behaviour
            const page = this.dataset.page;
            loadPosts(page, null);
            setTimeout(() => {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
            });
        }, 100);
        });
    });
}

// Update pagination
function updatePagination(paginationNavBottom, hasNext, currentPage, totalPosts) {
    if (totalPosts === 0) {
        paginationNavBottom.innerHTML = '';
        const paginationNavTop = document.getElementById("pagination-nav-top");
        if (paginationNavTop) {
            paginationNavTop.innerHTML = '';
        }
        return;
    }

    let paginationHTML = '';

    // Button "Previous"
    if (currentPage > 1) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>`;
    }

    // Current page
    paginationHTML += `
        <li class="page-item active">
            <span class="page-link">${currentPage}</span>
        </li>`;

    // Button "Next"
    if (hasNext) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" data-page="${parseInt(currentPage) + 1}" aria-label="Next">
                    <i class="bi bi-chevron-right"></i> <!-- Правая стрелка -->
                </a>
            </li>`;
    }

    paginationNavBottom.innerHTML = `<ul class="pagination justify-content-center">${paginationHTML}</ul>`;
    const paginationNavTop = document.getElementById("pagination-nav-top");
    if (paginationNavTop) {
        paginationNavTop.innerHTML = paginationNavBottom.innerHTML;
    }

    addPaginationListeners();
}

// Post Rendering
function renderPost(post, isNew = false) {
    const postElement = document.createElement("div");
    const isCreator = post.user_created === currentUser;



    if (!post || !post.id || !post.user_created) {
        console.error("Invalid post data passed to renderPost:", post);
        return null;
    }

    postElement.className = `post-container border p-3 mb-3 d-flex flex-column ${isNew ? "new-post" : ""}`;
    postElement.innerHTML = `
        <div class="post-header d-flex justify-content-between align-items-center">
            <h3><a href="/${post.user_created}" class="user-profile text-decoration-none text-dark">${post.user_created}</a></h3>
            <small class="text-muted">${post.dt_created}</small>
        </div>
        
        ${isCreator ? `
            <small class="editDeleteButton">
                <a href="#" class="text-primary edit-button">Edit</a> | 
                <a href="#" class="text-danger delete-button">Delete</a>
            </small>
        ` : ''
        }
        <span class="post-description" ${post.raw_description ? `data-raw-markdown="${post.raw_description}"` : ''}>
            ${post.description}
        </span>            
        <div>
            <i class="bi ${post.liked_by_current_user ? 'bi-heart-fill' : 'bi-heart'} icon-heart" data-post-id="${post.id}"></i>
            <small class="text-muted ms-2">${post.likes_count}</small>
        </div>
        <div class="saveCancelButton">
            <button class="btn btn-primary btn-sm mt-2">Save</button>
            <button class="btn btn-secondary btn-sm mt-2">Cancel</button>
        </div>
    `;

    //Edit Handler
    const editButton = postElement.querySelector('.edit-button');
    if (editButton) {
        editButton.onclick = function (e) {
            e.preventDefault();
            enableEdit(postElement, post.id)
        };
    }

    // Delete Handler
    const deleteButton = postElement.querySelector('.delete-button');
    if (deleteButton) {
        deleteButton.onclick = function (e) {
            e.preventDefault();
            deletePost(postElement, post.id);
        };
    }

    return postElement;
}

// Load Posts and pagination
function loadPosts(page = 1, username=null, following = false) {
    currentPage = page;

    // Determine URL based on the current context
    let url = `/?page=${page}`; // Default: All Posts
    if (username) {
        url = `/${username}?page=${page}`; // User-specific posts
    } else if (following) {
        url = `/?following=true&page=${page}`; // Following nav
    }

    fetch(url, { headers: { "x-requested-with": "XMLHttpRequest" } })
        .then(response => response.json())
        .then(data => {
            const postsList = document.getElementById("posts-list");
            const noPostsMessage = document.getElementById("no-posts-message");
            const paginationNav = document.getElementById("pagination-nav-bottom");

            postsList.innerHTML = '';

            if (data.posts.length === 0) {
                // Show the "No posts" message and hide pagination
                noPostsMessage.style.display = 'block';
                updatePagination(paginationNav, data.has_next, currentPage, 0);
            } else {
                // Hide the "No posts" message and display posts
                noPostsMessage.style.display = 'none';

                data.posts.forEach(post => {
                    const postElement = renderPost(post);
                    postsList.append(postElement);
                });

                // Update pagination
                updatePagination(paginationNav, data.has_next, currentPage, data.posts.length);
            }
        });
}

document.addEventListener('DOMContentLoaded', function() {
    const pageHeader = document.getElementById("page-header");
    const createNewPost = document.getElementById("create-new-post");
    const userProfile = document.getElementById("user-profile");
    const Following = document.getElementById("Following");
    const newPostForm = document.getElementById("new-post-form");

    pageHeader.textContent = 'All Posts';
    createNewPost.style.display = 'block';
    userProfile.style.display = 'none';

    document.querySelector('#AllPosts').addEventListener('click', () => {
        pageHeader.textContent = 'All Posts';
        createNewPost.style.display = 'block';
        userProfile.style.display = 'none';
        loadPosts(1, null)
    });

    if (Following) {
        document.querySelector('#Following').addEventListener('click', () => {
            pageHeader.textContent = 'Following';
            createNewPost.style.display = 'none';
            userProfile.style.display = 'none';
            loadPosts(1, null, true)
        })
    }

    // Handles
    if(newPostForm){
        document.getElementById("new-post-form").onsubmit = handleNewPost; // Create New Post
    }
    // if click on username + Like/unlike
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('user-profile')) {
            e.preventDefault();
            const username = e.target.getAttribute('href').substring(1);
            pageHeader.textContent = username;
            createNewPost.style.display = 'none';
            loadUserProfile(username);
        }
        else if(e.target.classList.contains('icon-heart')) {
            likeHandle(e);
        }
    });

    loadPosts(1, null);
});