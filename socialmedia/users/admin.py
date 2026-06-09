from django.contrib import admin
from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'followers_count')
    search_fields = ('user__username', 'bio')

    def followers_count(self, obj):
        return obj.followers.count()
