from django.db import models
from django.contrib.auth.models import User

class Profile(models.Model):

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile'
    )

    bio = models.TextField(blank=True)

    headline = models.CharField(
        max_length=120,
        blank=True,
        default=''
    )

    location = models.CharField(
        max_length=80,
        blank=True,
        default=''
    )

    website = models.URLField(
        blank=True,
        default=''
    )

    skills = models.CharField(
        max_length=180,
        blank=True,
        default=''
    )

    profile_pic = models.ImageField(
        upload_to='profile_pics/',
        default='profile_pics/default.png',
        blank=True
    )

    followers = models.ManyToManyField(
        User,
        blank=True,
        related_name='following'
    )

    def __str__(self):
        return self.user.username

    @property
    def avatar_url(self):
        if self.profile_pic and self.profile_pic.name:
            return self.profile_pic.url

        return '/media/profile_pics/default.png'
