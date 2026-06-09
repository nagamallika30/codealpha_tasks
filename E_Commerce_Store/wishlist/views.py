from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required

from .models import Wishlist
from products.models import Product


@login_required
def add_to_wishlist(request, id):

    product = Product.objects.get(id=id)

    Wishlist.objects.get_or_create(
        user=request.user,
        product=product
    )

    return redirect('/')


@login_required
def wishlist_page(request):

    items = Wishlist.objects.filter(
        user=request.user
    )

    return render(request, 'wishlist.html', {
        'items': items
    })


@login_required
def remove_from_wishlist(request, id):

    item = Wishlist.objects.get(
        id=id,
        user=request.user
    )

    item.delete()

    return redirect('wishlist_page')