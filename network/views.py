from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.db import IntegrityError
from django.http import HttpResponseRedirect, JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.core.paginator import Paginator
import json

from .models import User, Post, Subscription

def index(request):
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        # Get all posts
        posts = Post.objects.all().order_by('-dt_created')

        # Pagination (10 in page)
        paginator = Paginator(posts, 10)
        page_number = request.GET.get('page', 1) # get current page number
        page_obj = paginator.get_page(page_number) # get page with posts

        posts_data = [
            {
                "id": post.id,
                "user_created": post.user_created.username,
                "description": post.get_html_description(),
                "dt_created": post.dt_created.strftime("%B %d, %Y, %I:%M %p"),
                "likes_count": post.likes_count
            }
            for post in page_obj
        ]
        return JsonResponse({"posts": posts_data, "has_next": page_obj.has_next()}, safe=False)

    return render(request, "network/index.html")


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