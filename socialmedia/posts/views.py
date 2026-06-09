from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from users.models import Profile
from .models import Post, Comment


@login_required
def home(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)
    existing_profile_ids = Profile.objects.values_list('user_id', flat=True)
    missing_profiles = [
        Profile(user=user)
        for user in User.objects.exclude(id__in=existing_profile_ids)
    ]
    Profile.objects.bulk_create(missing_profiles, ignore_conflicts=True)

    posts = (
        Post.objects.select_related('user', 'user__profile')
        .prefetch_related('likes', 'comment_set__user')
        .order_by('-created_at')
    )
    suggestions = (
        User.objects.exclude(id=request.user.id)
        .exclude(profile__followers=request.user)
        .select_related('profile')
        .order_by('?')[:5]
    )

    posts_count = request.user.posts.count()
    followers_count = profile.followers.count()
    following_count = request.user.following.count()

    return render(request, 'home.html', {
        'posts': posts,
        'posts_count': posts_count,
        'followers_count': followers_count,
        'following_count': following_count,
        'suggestions': suggestions,
    })


@login_required
@require_POST
def create_post(request):

    content = request.POST.get('content', '').strip()
    image = request.FILES.get('image')

    if content or image:
        Post.objects.create(
            user=request.user,
            content=content,
            image=image
        )
    else:
        messages.error(request, 'Write something or choose an image before posting.')

    return redirect('home')


@login_required
@require_POST
def like_post(request, post_id):

    post = get_object_or_404(Post, id=post_id)

    if post.likes.filter(id=request.user.id).exists():
        post.likes.remove(request.user)
        liked = False

    else:
        post.likes.add(request.user)
        liked = True

    return JsonResponse({
        'liked': liked,
        'likes': post.likes.count()
    })


@login_required
@require_POST
def add_comment(request, post_id):

    post = get_object_or_404(Post, id=post_id)
    text = request.POST.get('text', '').strip()

    if text:
        Comment.objects.create(
            post=post,
            user=request.user,
            text=text
        )
    else:
        messages.error(request, 'Comment cannot be empty.')

    return redirect('home')


@login_required
@require_POST
def delete_post(request, post_id):
    post = get_object_or_404(Post, id=post_id, user=request.user)
    post.delete()
    messages.success(request, 'Post deleted.')
    return redirect('home')
