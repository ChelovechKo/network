let currentEditablePost = null;

function adjustHeight(el) {
    /* Auto Change Height in form-control */
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

document.addEventListener('DOMContentLoaded', function() {
    let currentPage = 1;

    // Инициализация
    /*
    document.getElementById("load-more").onclick = function() {
        currentPage++;
        loadPosts();
    };
     */

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
        console.log("rawMarkdown:", rawMarkdown);
        console.log("oldDescription:", oldDescription);
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

    // Post Rendering
    function renderPost(post, isNew = false) {
        const postElement = document.createElement("div");
        const isCreator = post.user_created === currentUser;

        postElement.className = `post-container border p-3 mb-3 d-flex flex-column ${isNew ? "new-post" : ""}`;
        postElement.innerHTML = `
            <h3>${post.user_created}</h3>
            ${isCreator ? `
                <small class="editDeleteButton">
                    <a href="#" class="text-primary edit-button">Edit</a> | 
                    <a href="#" class="text-danger delete-button">Delete</a>
                </small>
            ` : ''
            }
            <span class="post-description" ${post.raw_description ? `data-raw-markdown="${post.raw_description}"` : ''}>${post.description}</span>
            <span class="text-muted">${post.dt_created}</span>
            <small class="text-muted">Likes: ${post.likes_count}</small>
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

    // Load Posts
    function loadPosts() {
        fetch(`/?page=${currentPage}`, { headers: { "x-requested-with": "XMLHttpRequest" } })
            .then(response => response.json())
            .then(data => {
                const postsList = document.getElementById("posts-list");
                data.posts.forEach(post => {
                    const postElement = renderPost(post);
                    postsList.append(postElement);
                });

                /*
                if (!data.has_next) {
                    document.getElementById("load-more").style.display = "none";
                }
                 */
            });
    }

    loadPosts();

    // If submit Create New Post
    document.getElementById("new-post-form").onsubmit = function(event) {
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
            postsList.prepend(postElement);

            postElement.style.animationPlayState = 'running';
            postElement.addEventListener('animationend', () => {
                    postElement.classList.remove('new-post');
                });

            description.value = "";
            description.style.height = "";
        })
        .catch(error => console.error("Error:", error));
    };
});