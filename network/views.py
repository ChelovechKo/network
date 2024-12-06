from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.db import IntegrityError
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import render, get_object_or_404
from django.urls import reverse
from django.core.paginator import Paginator
import json

from .models import User, Post, Subscription, Like

def format_posts(posts, current_user):
    return [
        {
            "id": post.id,
            "user_created": post.user_created.username,
            "description": post.get_html_description(),
            "dt_created": post.dt_created.strftime("%B %d, %Y, %I:%M %p"),
            "likes_count": post.likes_count,
            "liked_by_current_user": (
                    current_user.is_authenticated and
                    post.likes.filter(user=current_user).exists()
            )
        }
        for post in posts
    ]

def index(request, username=None):
    # Default values
    is_following = False
    profile_user = None
    profile_data = None
    posts = Post.objects.all().order_by('-dt_created')  # All posts
    following = request.GET.get('following', 'false').lower() == 'true'

    if username:
        profile_user = get_object_or_404(User, username=username)
        posts = Post.objects.filter(user_created=profile_user).order_by("-dt_created")  # User's posts
        # Follow status
        if request.user.is_authenticated:
            is_following = Subscription.objects.filter(user_follower=request.user, following_user=profile_user).exists()
    elif following and request.user.is_authenticated:
        following_users = request.user.following.values_list('following_user', flat=True)
        posts = Post.objects.filter(user_created__in=following_users).order_by("-dt_created")

    # Profile data
    if profile_user:
        profile_data = {
            "profile_user": profile_user.username if profile_user else None,
            "profile_id": profile_user.id if profile_user else None,
            "following_count": profile_user.following.count() if profile_user else 0,
            "followers_count": profile_user.followers.count() if profile_user else 0,
            "is_following": is_following,
        }

    # Pagination (10 in page)
    page_number = request.GET.get('page', 1)
    paginator = Paginator(posts, 10)
    page_obj = paginator.get_page(page_number)

    # AJAX response
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        posts_data = format_posts(page_obj, request.user)
        return JsonResponse({
            "profile": profile_data,
            "posts": posts_data,
            "has_next": page_obj.has_next()
        }, safe=False)

    return render(request, "network/index.html", {
        "page_obj": page_obj,
        "profile_data": profile_data,
        "following": following,
    })

def login_view(request):
    if request.method == "POST":

        # Attempt to sign user in
        username = request.POST["username"]
        password = request.POST["password"]
        user = authenticate(request, username=username, password=password)

        # Check if authentication successful
        if user is not None:
            login(request, user)
            return HttpResponseRedirect(reverse("index"))
        else:
            return render(request, "network/login.html", {
                "message": "Invalid username and/or password."
            })
    else:
        return render(request, "network/login.html")


def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse("index"))


def register(request):
    if request.method == "POST":
        username = request.POST["username"]
        email = request.POST["email"]

        # Ensure password matches confirmation
        password = request.POST["password"]
        confirmation = request.POST["confirmation"]
        if password != confirmation:
            return render(request, "network/register.html", {
                "message": "Passwords must match."
            })

        # Attempt to create new user
        try:
            user = User.objects.create_user(username, email, password)
            user.save()
        except IntegrityError:
            return render(request, "network/register.html", {
                "message": "Username already taken."
            })
        login(request, user)
        return HttpResponseRedirect(reverse("index"))
    else:
        return render(request, "network/register.html")


@login_required
def new_post(request):
    if request.method == "POST":
        description = request.POST.get("description")
        if description:
            post = Post.objects.create(user_created=request.user, description=description)

            post.save()
            return JsonResponse({
                "id": post.id,
                "user_created": post.user_created.username,
                "description": post.get_html_description(),
                "raw_description": post.description,
                "dt_created": post.dt_created.strftime("%B %d, %Y, %I:%M %p"),
                "likes_count": post.likes_count,
            })
    return JsonResponse({"error": "POST request required."}, status=400)

@login_required
def edit_post(request, post_id):
    if request.method == "PUT":
        data = json.loads(request.body)
        post = Post.objects.get(id=post_id, user_created=request.user)

        post.description = data.get("description", post.description)
        post.save()

        return JsonResponse({
            "id": post.id,
            "description": post.get_html_description(),
            "raw_description": post.description,
            "dt_created": post.dt_created.strftime("%B %d, %Y, %I:%M %p"),
            "likes_count": post.likes_count,
        })

@login_required
def delete_post(request, post_id):
    if request.method == "DELETE":
        post = Post.objects.get(id=post_id, user_created=request.user)
        post.delete()
        return JsonResponse({"message": "Post deleted successfully"})


@login_required
def toggle_follow(request, username):
    '''Change Follow/Unfollow '''
    user_to_follow = get_object_or_404(User, username=username)

    subscription, created = Subscription.objects.get_or_create(
        user_follower=request.user, following_user=user_to_follow
    )

    if not created:
        subscription.delete()
        is_following = False
    else:
        is_following = True

    return JsonResponse({
        "is_following": is_following,
        "following_count": user_to_follow.following.count(),
        "followers_count": user_to_follow.followers.count(),
    })

@login_required
def toggle_like(request, post_id):
    """ like/unlike for a post"""
    post = get_object_or_404(Post, id=post_id)
    user = request.user
    liked = False

    like, created = Like.objects.get_or_create(user=user, post=post)

    if not created:
        like.delete() # If the like already exists, remove it (unlike)
        liked = False
    else:
        liked = True # Otherwise, the user has liked the post

    # Update the like count on the post
    post.likes_count = post.likes.count()
    post.save()

    return JsonResponse({
        'liked': liked,
        'likes_count': post.likes_count
    })