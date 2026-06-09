from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import Profile


class UserViewsTest(TestCase):
    def test_register_creates_user_and_profile(self):
        response = self.client.post(reverse('register'), {
            'username': 'alice',
            'password': 'password123',
        })

        user = User.objects.get(username='alice')
        self.assertRedirects(response, reverse('login'))
        self.assertTrue(Profile.objects.filter(user=user).exists())

    def test_register_rejects_duplicate_username(self):
        User.objects.create_user(username='alice', password='password123')

        response = self.client.post(reverse('register'), {
            'username': 'alice',
            'password': 'password123',
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.filter(username='alice').count(), 1)

    def test_login_redirects_authenticated_user_home(self):
        User.objects.create_user(username='alice', password='password123')

        response = self.client.post(reverse('login'), {
            'username': 'alice',
            'password': 'password123',
        })

        self.assertRedirects(response, reverse('home'))

    def test_profile_requires_login(self):
        response = self.client.get(reverse('profile', args=['alice']))

        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response['Location'])

    def test_follow_toggles_target_user(self):
        alice = User.objects.create_user(username='alice', password='password123')
        bob = User.objects.create_user(username='bob', password='password123')
        bob_profile = bob.profile
        self.client.login(username='alice', password='password123')

        self.client.post(reverse('follow_user', args=['bob']))
        self.assertTrue(bob_profile.followers.filter(id=alice.id).exists())

        self.client.post(reverse('follow_user', args=['bob']))
        self.assertFalse(bob_profile.followers.filter(id=alice.id).exists())

    def test_user_cannot_follow_self(self):
        alice = User.objects.create_user(username='alice', password='password123')
        profile = alice.profile
        self.client.login(username='alice', password='password123')

        self.client.post(reverse('follow_user', args=['alice']))

        self.assertFalse(profile.followers.filter(id=alice.id).exists())

    def test_profile_lookup_is_case_insensitive(self):
        User.objects.create_user(username='mallika', password='password123')
        viewer = User.objects.create_user(username='viewer', password='password123')
        self.client.login(username='viewer', password='password123')

        response = self.client.get(reverse('profile', args=['Mallika']))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'mallika')

    def test_search_users_finds_matching_username(self):
        User.objects.create_user(username='mallika', password='password123')
        viewer = User.objects.create_user(username='viewer', password='password123')
        self.client.login(username='viewer', password='password123')

        response = self.client.get(reverse('search_users'), {'q': 'mall'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'mallika')

    def test_edit_profile_updates_bio(self):
        alice = User.objects.create_user(username='alice', password='password123')
        self.client.login(username='alice', password='password123')

        response = self.client.post(reverse('edit_profile'), {
            'bio': 'Django intern building social apps.',
        })

        alice.profile.refresh_from_db()
        self.assertRedirects(response, reverse('profile', args=['alice']))
        self.assertEqual(alice.profile.bio, 'Django intern building social apps.')
