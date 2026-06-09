from django import forms

from .models import Profile


class ProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ['headline', 'bio', 'location', 'website', 'skills', 'profile_pic']
        widgets = {
            'headline': forms.TextInput(attrs={
                'placeholder': 'Example: Full Stack Developer Intern',
            }),
            'bio': forms.Textarea(attrs={
                'placeholder': 'Add a short bio for your profile',
                'rows': 4,
            }),
            'location': forms.TextInput(attrs={
                'placeholder': 'Example: Chennai, India',
            }),
            'website': forms.URLInput(attrs={
                'placeholder': 'https://your-portfolio.com',
            }),
            'skills': forms.TextInput(attrs={
                'placeholder': 'Django, Python, HTML, CSS, JavaScript',
            }),
        }
