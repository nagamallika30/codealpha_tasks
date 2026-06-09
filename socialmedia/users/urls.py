from django.urls import path
from django.contrib.auth.views import LogoutView
from . import views

urlpatterns = [

    path('register/', views.register_view, name='register'),

    path('login/', views.login_view, name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('search/', views.search_users, name='search_users'),
    path('profile/edit/', views.edit_profile, name='edit_profile'),
    path('profile/<str:username>/',
         views.profile_view,
         name='profile'),
    path('follow/<str:username>/', views.follow_user, name='follow_user'),

]
