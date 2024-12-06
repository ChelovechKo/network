from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.timezone import now
from markdown import markdown


class User(AbstractUser):
    pass


class Post(models.Model):
    user_created = models.ForeignKey('User', on_delete=models.CASCADE, related_name='posts')
    dt_created = models.DateTimeField(default=now)
    description = models.TextField()
    likes_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f'Post {self.id} by {self.user_created}'

    def get_html_description(self):
        return markdown(self.description)


class Subscription(models.Model):
    following_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="followers")
    user_follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name="following")

    def __str__(self):
        return f'{self.user_follower.username} follows {self.following_user.username}'

class Like(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='likes')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='likes')

    class Meta:
        unique_together = ('user', 'post')

    def __str__(self):
        return f"{self.user.username} liked {self.post.id}"