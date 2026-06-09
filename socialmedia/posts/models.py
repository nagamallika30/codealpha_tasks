from django.db import models
from django.contrib.auth.models import User

class Post(models.Model):

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='posts'
    )

    content = models.TextField()

    image = models.ImageField(
        upload_to='posts/',
        blank=True,
        null=True
    )

    likes = models.ManyToManyField(
        User,
        related_name='liked_posts',
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.user.username

    def total_likes(self):
        return self.likes.count()


    
class Comment(models.Model):

    post = models.ForeignKey(Post, on_delete=models.CASCADE)

    user = models.ForeignKey(User, on_delete=models.CASCADE)

    text = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.user.username