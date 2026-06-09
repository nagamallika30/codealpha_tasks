from django.shortcuts import render, get_object_or_404
from .models import Product
from django.shortcuts import render

from cart.models import Cart


from django.http import JsonResponse
from .models import Product
from cart.models import Cart


def home(request):

    query = request.GET.get('q')

    if query:
        products = Product.objects.filter(
            name__icontains=query
        )
    else:
        products = Product.objects.all()

    cart_count = 0

    if request.user.is_authenticated:
        cart_count = Cart.objects.filter(
            user=request.user
        ).count()

    # AJAX request
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':

        data = []

        for product in products:
            data.append({
                'id': product.id,
                'name': product.name,
                'price': product.price,
                'image': product.image
            })

        return JsonResponse(data, safe=False)

    return render(request, 'home.html', {
        'products': products,
        'cart_count': cart_count
    })
   

# PRODUCT DETAILS PAGE
from django.shortcuts import render, get_object_or_404
from .models import Product
from reviews.models import Review

def product_detail(request, id):
    product = get_object_or_404(Product, id=id)

    reviews = Review.objects.filter(product=product).order_by('-created_at')

    return render(request, 'product_detail.html', {
        'product': product,
        'reviews': reviews
    })