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
    user_id = models.ForeignKey(User, on_delete=models.CASCADE, related_name="following")
    user_follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name="followers")

    def __str__(self):
        return f'{self.user_follower.username} follows {self.user_id.username}'