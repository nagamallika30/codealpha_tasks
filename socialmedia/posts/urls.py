from django.urls import path
from . import views

urlpatterns = [

    path('', views.home, name='home'),

    path('create-post/', views.create_post, name='create_post'),

    path('comment/<int:post_id>/', views.add_comment, name='add_comment'),
    
    path('like/<int:post_id>/', views.like_post, name='like_post'),

    path('post/<int:post_id>/delete/', views.delete_post, name='delete_post'),
]
