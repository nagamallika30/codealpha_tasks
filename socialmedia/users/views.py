from django.contrib import messages
from django.contrib.auth import authenticate, login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from posts.models import Post
from .forms import ProfileForm
from .models import Profile


def register_view(request):

    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        if not username or not password:
            messages.error(request, 'Username and password are required.')
            return render(request, 'register.html')

        if User.objects.filter(username=username).exists():
            messages.error(request, 'That username is already taken.')
            return render(request, 'register.html')

        user = User.objects.create_user(
            username=username,
            password=password
        )

        Profile.objects.get_or_create(user=user)

        return redirect('login')

    return render(request, 'register.html')


def login_view(request):

    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        user = authenticate(
            request,
            username=username,
            password=password
        )

        if user is not None:

            login(request, user)

            return redirect('home')

        messages.error(request, 'Invalid username or password.')

    return render(request, 'login.html')


@login_required
def profile_view(request, username):

    user = get_object_or_404(User, username__iexact=username)

    profile, created = Profile.objects.get_or_create(user=user)

    is_following = profile.followers.filter(id=request.user.id).exists()

    posts_count = Post.objects.filter(user=user).count()
    followers_count = profile.followers.count()
    following_count = user.following.count()
    posts = (
        Post.objects.filter(user=user)
        .prefetch_related('likes', 'comment_set')
        .order_by('-created_at')
    )

    return render(request, 'profile.html', {
        'profile': profile,
        'is_following': is_following,
        'posts_count': posts_count,
        'followers_count': followers_count,
        'following_count': following_count,
        'posts': posts,
    })


@login_required
def edit_profile(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)

    if request.method == 'POST':
        form = ProfileForm(request.POST, request.FILES, instance=profile)

        if form.is_valid():
            form.save()
            messages.success(request, 'Profile updated successfully.')
            return redirect('profile', username=request.user.username)
    else:
        form = ProfileForm(instance=profile)

    return render(request, 'edit_profile.html', {
        'form': form,
        'profile': profile,
    })


@login_required
def search_users(request):
    query = request.GET.get('q', '').strip()
    users = User.objects.none()

    if query:
        users = (
            User.objects.filter(
                Q(username__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
            )
            .select_related('profile')
            .order_by('username')[:20]
        )

    return render(request, 'search.html', {
        'query': query,
        'users': users,
    })


@login_required
@require_POST
def follow_user(request, username):

    target_user = get_object_or_404(User, username__iexact=username)

    profile, _ = Profile.objects.get_or_create(user=target_user)

    if request.user == target_user:
        messages.error(request, 'You cannot follow yourself.')
        return redirect('profile', username=username)

    if profile.followers.filter(id=request.user.id).exists():

        profile.followers.remove(request.user)

    else:

        profile.followers.add(request.user)

    return redirect('profile', username=username)
