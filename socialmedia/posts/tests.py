from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from users.models import Profile
from .models import Comment, Post


class PostViewsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', password='password123')
        self.client.login(username='alice', password='password123')

    def test_home_requires_login(self):
        self.client.logout()

        response = self.client.get(reverse('home'))

        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response['Location'])

    def test_home_creates_missing_profile(self):
        user = User.objects.create_user(username='adminmade', password='password123')
        Profile.objects.filter(user=user).delete()
        self.client.logout()
        self.client.login(username='adminmade', password='password123')

        response = self.client.get(reverse('home'))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(Profile.objects.filter(user=user).exists())

    def test_create_post_ignores_empty_content(self):
        response = self.client.post(reverse('create_post'), {'content': '   '})

        self.assertRedirects(response, reverse('home'))
        self.assertEqual(Post.objects.count(), 0)

    def test_create_post_saves_trimmed_content(self):
        self.client.post(reverse('create_post'), {'content': '  Hello feed  '})

        post = Post.objects.get()
        self.assertEqual(post.content, 'Hello feed')
        self.assertEqual(post.user, self.user)

    def test_like_post_toggles_like(self):
        post = Post.objects.create(user=self.user, content='Hello')

        first = self.client.post(reverse('like_post', args=[post.id]))
        second = self.client.post(reverse('like_post', args=[post.id]))

        self.assertJSONEqual(first.content, {'liked': True, 'likes': 1})
        self.assertJSONEqual(second.content, {'liked': False, 'likes': 0})

    def test_add_comment_ignores_empty_comment(self):
        post = Post.objects.create(user=self.user, content='Hello')

        response = self.client.post(reverse('add_comment', args=[post.id]), {'text': '   '})

        self.assertRedirects(response, reverse('home'))
        self.assertEqual(Comment.objects.count(), 0)

    def test_add_comment_saves_trimmed_text(self):
        post = Post.objects.create(user=self.user, content='Hello')

        self.client.post(reverse('add_comment', args=[post.id]), {'text': '  Nice post  '})

        comment = Comment.objects.get()
        self.assertEqual(comment.text, 'Nice post')
        self.assertEqual(comment.user, self.user)

    def test_delete_post_only_removes_own_post(self):
        other = User.objects.create_user(username='bob', password='password123')
        own_post = Post.objects.create(user=self.user, content='Mine')
        other_post = Post.objects.create(user=other, content='Not mine')

        own_response = self.client.post(reverse('delete_post', args=[own_post.id]))
        other_response = self.client.post(reverse('delete_post', args=[other_post.id]))

        self.assertRedirects(own_response, reverse('home'))
        self.assertEqual(other_response.status_code, 404)
        self.assertFalse(Post.objects.filter(id=own_post.id).exists())
        self.assertTrue(Post.objects.filter(id=other_post.id).exists())
