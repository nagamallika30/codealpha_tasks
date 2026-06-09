from django.db import models

class Product(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField()
    price = models.FloatField()
    image = models.URLField()
    stock = models.IntegerField()

    def __str__(self):
        return self.name