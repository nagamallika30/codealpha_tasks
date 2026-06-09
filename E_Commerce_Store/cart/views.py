from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.core.mail import send_mail
from .models import Cart
from products.models import Product
from orders.models import Order, OrderItem




# 🛒 ADD TO CART
@login_required
def add_to_cart(request, id):
    product = Product.objects.get(id=id)

    cart_item, created = Cart.objects.get_or_create(
        user=request.user,
        product=product
    )

    if not created:
        cart_item.quantity += 1
        cart_item.save()

    cart_count = Cart.objects.filter(user=request.user).count()

    return JsonResponse({
        'success': True,
        'cart_count': cart_count
    })


# 🛒 CART PAGE
@login_required
def cart_page(request):
    items = Cart.objects.filter(user=request.user)

    total = 0

    for item in items:
        total += item.product.price * item.quantity

    return render(request, 'cart.html', {
        'items': items,
        'total': total
    })


# ❌ REMOVE ITEM FROM CART

@login_required
def remove_from_cart(request, id):
    item = Cart.objects.get(id=id, user=request.user)
    item.delete()

    # new cart count after delete
    cart_count = Cart.objects.filter(user=request.user).count()

    return JsonResponse({
        'success': True,
        'cart_count': cart_count
    })
    
     

@login_required
def increase_quantity(request, id):
    item = Cart.objects.get(id=id, user=request.user)
    item.quantity += 1
    item.save()

    cart_count = Cart.objects.filter(user=request.user).count()

    return JsonResponse({
        "success": True,
        "quantity": item.quantity,
        "cart_count": cart_count
    })


@login_required
def decrease_quantity(request, id):
    item = Cart.objects.get(id=id, user=request.user)

    if item.quantity > 1:
        item.quantity -= 1
        item.save()
        removed = False
    else:
        item.delete()
        removed = True

    cart_count = Cart.objects.filter(user=request.user).count()

    return JsonResponse({
        "success": True,
        "quantity": 0 if removed else item.quantity,
        "removed": removed,
        "cart_count": cart_count
    })


# ✅ CHECKOUT / PLACE ORDER
@login_required


def checkout(request):
    items = Cart.objects.filter(user=request.user)

    total = 0
    for item in items:
        total += item.product.price * item.quantity

    order = Order.objects.create(
        user=request.user,
        total_price=total
    )

    for item in items:
        OrderItem.objects.create(
            order=order,
            product_name=item.product.name,
            price=item.product.price,
            quantity=item.quantity
        )

    items.delete()

    # EMAIL PART
    send_mail(
        subject="🎉 Order Confirmed - ShopSphere",
        message=f"Hi {request.user.username},\n\nYour order #{order.id} is confirmed!\nTotal: ₹{order.total_price}",
        from_email="shopsphere@gmail.com",
        recipient_list=[request.user.email],
        fail_silently=False,
    )

    return render(request, 'order_success.html', {'order': order})
    
from django.shortcuts import redirect

def buy_now(request, id):

    product = Product.objects.get(id=id)

    cart_item, created = Cart.objects.get_or_create(
        user=request.user,
        product=product
    )

    if not created:
        cart_item.quantity += 1
        cart_item.save()

    return redirect('cart_page')