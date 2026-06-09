from django.shortcuts import render, redirect
from .models import Review
from products.models import Product

def add_review(request, id):
    product = Product.objects.get(id=id)

    if request.method == "POST":
        rating = request.POST.get('rating')
        comment = request.POST.get('comment')

        Review.objects.create(
            product=product,
            user=request.user,
            rating=rating,
            comment=comment
        )

        return redirect('product_detail', id=product.id)

    return render(request, 'add_review.html', {'product': product})